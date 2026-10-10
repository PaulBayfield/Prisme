import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";

import { pool } from "./db";
import { parseSessionDuration, SESSION_DURATION_COOKIE } from "./session-duration";
import type { UserSession } from "./types";
import { parseUserAgent } from "./user-agent";

// The session JWT alone can't be listed or revoked - it's valid until it
// expires no matter what. Each sign-in therefore also gets a user_sessions
// row whose id is embedded in the JWT (see lib/auth.ts): the row is the
// source of truth for "is this session still alive", and deleting it signs
// that device out on its next request.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVE = "last_seen_at + make_interval(secs => idle_timeout_seconds) > now()";

// A session can always sign out the ones created after it, but only gets
// to sign out older ones once it is itself a day old. Without this, someone
// who gets signed in as you (stolen password, hijacked SSO) could lock you
// out of every device, and do it again each time you signed back in - while
// your own, older sessions could do nothing but race them. This way the
// established devices keep the upper hand for 24 hours: long enough to spot
// the intruder in the list and sign them out. Expects the acting session
// aliased as `actor` and the target as `target`.
const CAN_REVOKE = "(target.created_at > actor.created_at OR actor.created_at < now() - interval '72 hours')";

export function isSessionId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// Called from the jwt callback on sign-in, i.e. inside the
// /api/auth/callback route handler - the request's own headers/cookies are
// what describe the device signing in.
export async function createSession(email: string): Promise<string> {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const userAgent = headerStore.get("user-agent")?.slice(0, 512) ?? null;
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || null;
  const idleTimeout = parseSessionDuration(cookieStore.get(SESSION_DURATION_COOKIE)?.value);

  // Expired rows are otherwise never removed (nothing signs them out), so
  // every sign-in sweeps them.
  await pool.query(`DELETE FROM user_sessions WHERE NOT (${ACTIVE})`);

  // Authentik is the actual access gate here - anyone who can sign in is
  // allowed an account, so this provisions a `users` row on first login.
  // New accounts land in onboarding (onboarded_at IS NULL) until they
  // finish or skip it. Upsert avoids a race if two sign-ins for a brand new
  // user land concurrently.
  const { rows } = await pool.query<{ id: string }>(
    `WITH account AS (
       INSERT INTO users (email) VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id
     )
     INSERT INTO user_sessions (user_id, user_agent, ip, idle_timeout_seconds)
     SELECT id, $2::text, $3::text, $4::int FROM account
     RETURNING id`,
    [email, userAgent, ip, idleTimeout],
  );
  return rows[0].id;
}

// Read-only on purpose: this backs the jwt callback, which also runs for
// the client's background /api/auth/session poll - if that counted as
// activity, an open tab would never go idle.
export const isSessionActive = cache(async (sessionId: string): Promise<boolean> => {
  if (!isSessionId(sessionId)) return false;
  const { rows } = await pool.query(`SELECT 1 FROM user_sessions WHERE id = $1 AND ${ACTIVE}`, [sessionId]);
  return rows.length > 0;
});

// Records real activity (a page render or server action) and resolves the
// session's user in the same round trip. null means revoked or idle-expired.
export async function touchSession(sessionId: string): Promise<number | null> {
  if (!isSessionId(sessionId)) return null;
  const { rows } = await pool.query<{ user_id: string }>(
    `UPDATE user_sessions SET last_seen_at = now() WHERE id = $1 AND ${ACTIVE} RETURNING user_id`,
    [sessionId],
  );
  return rows[0] ? Number(rows[0].user_id) : null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (!isSessionId(sessionId)) return;
  await pool.query("DELETE FROM user_sessions WHERE id = $1", [sessionId]);
}

interface SessionRow {
  id: string;
  user_agent: string | null;
  ip: string | null;
  idle_timeout_seconds: number;
  created_at: Date;
  last_seen_at: Date;
  revocable: boolean;
}

export async function listSessions(userId: number, currentSessionId: string): Promise<UserSession[]> {
  const { rows } = await pool.query<SessionRow>(
    `SELECT target.id, target.user_agent, target.ip, target.idle_timeout_seconds, target.created_at,
            target.last_seen_at, (target.id <> actor.id AND ${CAN_REVOKE}) AS revocable
     FROM user_sessions target
     JOIN user_sessions actor ON actor.id = $2
     WHERE target.user_id = $1 AND target.last_seen_at + make_interval(secs => target.idle_timeout_seconds) > now()
     ORDER BY (target.id = actor.id) DESC, target.last_seen_at DESC`,
    [userId, currentSessionId],
  );
  return rows.map((row) => ({
    id: row.id,
    current: row.id === currentSessionId,
    revocable: row.revocable,
    ...parseUserAgent(row.user_agent),
    ip: row.ip,
    durationSeconds: row.idle_timeout_seconds,
    createdAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
  }));
}

// Scoped to user_id so a session id belonging to someone else is a no-op.
// Resolves to false when the target exists but the acting session isn't
// allowed to sign it out yet (see CAN_REVOKE); a target that is already
// gone counts as done.
export async function revokeSession(userId: number, actorSessionId: string, targetSessionId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM user_sessions target USING user_sessions actor
     WHERE target.id = $1 AND target.user_id = $2 AND actor.id = $3 AND ${CAN_REVOKE}`,
    [targetSessionId, userId, actorSessionId],
  );
  if (rowCount) return true;
  const { rows } = await pool.query("SELECT 1 FROM user_sessions WHERE id = $1 AND user_id = $2", [
    targetSessionId,
    userId,
  ]);
  return rows.length === 0;
}

// Only removes what the acting session may sign out - anything protected by
// CAN_REVOKE is left alone rather than failing the whole request.
export async function revokeOtherSessions(userId: number, actorSessionId: string): Promise<void> {
  await pool.query(
    `DELETE FROM user_sessions target USING user_sessions actor
     WHERE target.user_id = $1 AND actor.id = $2 AND target.id <> actor.id AND ${CAN_REVOKE}`,
    [userId, actorSessionId],
  );
}
