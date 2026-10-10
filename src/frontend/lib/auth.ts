import { type NextAuthOptions } from "next-auth";
import AuthentikProvider from "next-auth/providers/authentik";
import CredentialsProvider from "next-auth/providers/credentials";

import { isDemoMode } from "./env";
import { MAX_SESSION_DURATION } from "./session-duration";
import { createSession, deleteSession, isSessionActive } from "./sessions";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      given_name?: string | null;
      username?: string | null;
      groups?: string[];
    };
    loginTime?: number;
    sessionId?: string;
  }

  interface User {
    given_name?: string | null;
    username?: string | null;
    groups?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user?: import("next-auth").Session["user"];
    loginTime?: number;
    sessionId?: string;
  }
}

// Thrown from the jwt callback to end a session whose user_sessions row is
// gone (revoked from another device) or idle-expired: next-auth catches it,
// answers "no session" and clears the cookie.
class SessionEndedError extends Error {
  name = "SessionEndedError";
}

// The "demo" provider only exists when DEMO_MODE=true - it always
// authorizes and hands back a fixed identity, so the public showcase
// deploy never needs a real Authentik instance. lib/data.ts's demo branch
// never actually reads session.user.email to look up a user (it returns a
// fixed DEMO_USER_ID), so the email here is just cosmetic.
const demoProvider = CredentialsProvider({
  id: "demo",
  name: "Démo",
  credentials: {},
  async authorize() {
    return { id: "demo-user", email: "demo@prisme.app", name: "Compte Démo", given_name: "Démo" };
  },
});

// Demo mode never talks to Authentik at all (not just skips signing in
// through it) - the public showcase deploy shouldn't need AUTHENTIK_* env
// vars configured, so this provider isn't even constructed in that case.
function buildAuthentikProvider() {
  return AuthentikProvider({
    id: "prisme",
    name: "Authentik",
    issuer: process.env.AUTHENTIK_ISSUER!,
    clientId: process.env.AUTHENTIK_CLIENT_ID!,
    clientSecret: process.env.AUTHENTIK_CLIENT_SECRET!,
    authorization: { params: { scope: "openid profile email" } },
    userinfo: {
      url: process.env.AUTHENTIK_USER_INFO_URL!,
      async request(context) {
        const response = await fetch(process.env.AUTHENTIK_USER_INFO_URL!, {
          headers: {
            Authorization: `Bearer ${context.tokens.access_token}`,
          },
        });
        return response.json();
      },
    },
    profile(profile) {
      return {
        id: profile.sub,
        email: profile.email,
        name: profile.name,
        given_name: profile.given_name,
        username: profile.preferred_username,
        groups: profile.groups,
      };
    },
  });
}

export const authOptions: NextAuthOptions = {
  providers: isDemoMode ? [demoProvider] : [buildAuthentikProvider()],
  session: {
    strategy: "jwt",
    // Only the upper bound: the cookie has to outlive the longest duration a
    // device can pick. The real, per-device idle timeout is enforced against
    // the session's user_sessions row (see lib/sessions.ts).
    maxAge: MAX_SESSION_DURATION,
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.user = user;
        token.loginTime = Date.now();
        // Demo mode has no database to track sessions in.
        if (!isDemoMode) {
          if (!user.email) {
            throw new Error("The identity provider returned no email");
          }
          token.sessionId = await createSession(user.email);
        }
      } else if (!isDemoMode && !(token.sessionId && (await isSessionActive(token.sessionId)))) {
        // Also catches JWTs issued before sessions were tracked (no
        // sessionId) - those just have to sign in again once.
        throw new SessionEndedError();
      }
      return token;
    },
    async session({ session, token }) {
      if (token.user) {
        session.user = token.user;
      }
      session.loginTime = token.loginTime;
      session.sessionId = token.sessionId;
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (!isDemoMode && token?.sessionId) {
        await deleteSession(token.sessionId);
      }
    },
  },
  logger: {
    // An ended session is an expected outcome, not an error worth a stack
    // trace on every poll from a stale tab.
    error(code, metadata) {
      const error = metadata instanceof Error ? metadata : metadata?.error;
      if (error?.name === "SessionEndedError") return;
      console.error(`[next-auth][error][${code}]`, metadata);
    },
  },
};
