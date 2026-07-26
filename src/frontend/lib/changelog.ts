"use server";

import { unstable_cache } from "next/cache";

// Public repo, no auth needed for read access - same "use server" + fetch +
// unstable_cache shape as lib/exchange-rate.ts, including the bounded
// timeout: this is called on-demand from the Help dialog's Changelog tab
// (see components/help-dialog.tsx), not awaited from the root layout, but a
// hung fetch would still freeze that tab open on the timeout as scoped, so
// the same lesson applies (see lib/exchange-rate.ts's FETCH_TIMEOUT_MS).
const REPO = "PaulBayfield/Prisme";
const FETCH_TIMEOUT_MS = 8000;
const COMMIT_COUNT = 100;

export type ChangelogEntryType =
  | "feat"
  | "fix"
  | "perf"
  | "refactor"
  | "docs"
  | "style"
  | "test"
  | "build"
  | "ci"
  | "chore"
  | "revert"
  | "other";

export interface ChangelogEntry {
  sha: string;
  type: ChangelogEntryType;
  scope: string | null;
  message: string;
  date: string;
}

export interface DependencyBump {
  message: string;
  date: string;
}

export interface ChangelogData {
  entries: ChangelogEntry[];
  dependencyUpdates: DependencyBump[];
}

interface GitHubCommit {
  sha: string;
  commit: { message: string; author: { date: string } | null };
}

// Conventional Commits: "type(scope)?!?: description" - anything else
// (freeform messages, "Merge pull request #N from ...") doesn't match and
// is dropped rather than shown as a mystery unlabeled entry.
const CONVENTIONAL_COMMIT_RE = /^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/;
const KNOWN_TYPES = new Set<ChangelogEntryType>([
  "feat",
  "fix",
  "perf",
  "refactor",
  "docs",
  "style",
  "test",
  "build",
  "ci",
  "chore",
  "revert",
]);

function parseCommitSubject(subject: string): { type: ChangelogEntryType; scope: string | null; description: string } | null {
  const match = CONVENTIONAL_COMMIT_RE.exec(subject);
  if (!match) return null;
  const [, rawType, scope, description] = match;
  const type = KNOWN_TYPES.has(rawType as ChangelogEntryType) ? (rawType as ChangelogEntryType) : "other";
  return { type, scope: scope ?? null, description };
}

// Dependabot commits are all "chore(deps): ..." / "chore(deps-dev): ..." -
// grouped into their own bucket so a week with a dozen bumps doesn't drown
// out the actual feature/fix entries in the main timeline.
function isDependencyBump(type: ChangelogEntryType, scope: string | null): boolean {
  return type === "chore" && scope !== null && scope.startsWith("deps");
}

const getCachedChangelog = unstable_cache(
  async (): Promise<ChangelogData> => {
    const response = await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=${COMMIT_COUNT}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Internal sentinel, same reasoning as exchange-rate.ts's - getChangelog
      // below catches it and throws a translated message instead.
      throw new Error("changelog-fetch-failed");
    }

    const commits: GitHubCommit[] = await response.json();
    const entries: ChangelogEntry[] = [];
    const dependencyUpdates: DependencyBump[] = [];

    for (const commit of commits) {
      const subject = commit.commit.message.split("\n")[0]!.trim();
      const parsed = parseCommitSubject(subject);
      if (!parsed) continue;

      const date = commit.commit.author?.date ?? new Date().toISOString();

      if (isDependencyBump(parsed.type, parsed.scope)) {
        dependencyUpdates.push({ message: parsed.description, date });
        continue;
      }

      entries.push({ sha: commit.sha, type: parsed.type, scope: parsed.scope, message: parsed.description, date });
    }

    return { entries, dependencyUpdates };
  },
  ["changelog"],
  { revalidate: 3600 },
);

export async function getChangelog(): Promise<ChangelogData> {
  try {
    return await getCachedChangelog();
  } catch {
    throw new Error("changelog-fetch-failed");
  }
}
