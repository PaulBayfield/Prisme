// Pure recurring-charge detection shared between the real (Postgres) and
// demo (in-memory) data layers - both group the same raw transaction rows
// into candidate subscription/recurring series and need to agree on
// exactly how grouping and cadence classification work. See
// getRecurringTransactions in lib/data.real.ts / lib/demo/data.ts for the
// two row sources that feed this.

import { differenceInCalendarDays } from "date-fns";

import type { RecurringCadence, RecurringSeries } from "./types";

export interface RecurringCandidateRow {
  accountInternalId: string;
  accountLabel: string;
  label: string;
  amount: number;
  bookingDate: string;
  categoryName: string | null;
  categoryColor: string | null;
}

const MIN_OCCURRENCES = 3;

// avg gap (days) -> cadence, each with a tolerance band. Anything outside
// all four bands is irregular spending, not a subscription, and gets
// dropped.
const CADENCE_BANDS: { cadence: RecurringCadence; min: number; max: number }[] = [
  { cadence: "weekly", min: 5, max: 9 },
  { cadence: "monthly", min: 26, max: 35 },
  { cadence: "quarterly", min: 80, max: 100 },
  { cadence: "yearly", min: 350, max: 380 },
];

const MONTHLY_EQUIVALENT: Record<RecurringCadence, (amount: number) => number> = {
  weekly: (amount) => amount * (365 / 12 / 7),
  monthly: (amount) => amount,
  quarterly: (amount) => amount / 3,
  yearly: (amount) => amount / 12,
};

// Strips accents, long digit runs (references/dates/card numbers) and
// punctuation so "NETFLIX.COM 75019" and "netflix.com   75019" (or a
// slightly different trailing reference) group together.
export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\d{3,}/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The part of the grouping key that identifies "this recurring charge" on
// its own, independent of which account it's debited from - this is what
// gets persisted by ignoreRecurringTransaction (account is stored as its
// own column there, see schema.sql's ignored_recurring_transactions).
//
// Deliberately independent of amount - a subscription's price changing
// (e.g. an annual increase) must not split it into a new, separately-easy-
// to-miss series. Cadence classification below is amount-agnostic anyway
// (it only looks at date gaps), so this doesn't weaken detection.
export function recurringLabelKey(label: string): string {
  return normalizeLabel(label);
}

export function recurringGroupKey(accountInternalId: string, label: string): string {
  return `${accountInternalId}::${recurringLabelKey(label)}`;
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values: number[], mean: number): number {
  return Math.sqrt(average(values.map((v) => (v - mean) ** 2)));
}

// A merchant descriptor changing mid-subscription (e.g. a biller
// rebranding - "CLAUDE.AI SUBSCR" becoming "ANTHROPIC* CLAUD") splits it
// into two exact-label groups, each potentially too short/irregular on its
// own to pass detection. Two groups on the same account, charging the
// exact same amount, where one picks up within a plausible cadence window
// of the other ending, are merged back into one series before cadence
// classification runs - safer than fuzzy-matching labels, since it only
// ever merges an otherwise-clean handoff between two non-overlapping,
// identically-priced groups.
const RENAME_MERGE_MAX_GAP_DAYS = 45;

function mergeRenamedGroups(groups: RecurringCandidateRow[][]): RecurringCandidateRow[][] {
  const sortedGroups = groups.map((group) => [...group].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate)));
  const parent = sortedGroups.map((_, i) => i);
  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function union(a: number, b: number): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootA] = rootB;
  }

  const bounds = sortedGroups.map((group) => ({
    accountInternalId: group[0].accountInternalId,
    amountCents: Math.round(Math.abs(group[0].amount) * 100),
    first: new Date(group[0].bookingDate),
    last: new Date(group[group.length - 1].bookingDate),
  }));

  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      if (bounds[i].accountInternalId !== bounds[j].accountInternalId) continue;
      if (bounds[i].amountCents !== bounds[j].amountCents) continue;
      const [earlier, later] = bounds[i].last <= bounds[j].last ? [bounds[i], bounds[j]] : [bounds[j], bounds[i]];
      const gapDays = differenceInCalendarDays(later.first, earlier.last);
      if (gapDays >= 0 && gapDays <= RENAME_MERGE_MAX_GAP_DAYS) {
        union(i, j);
      }
    }
  }

  const clusters = new Map<number, RecurringCandidateRow[]>();
  for (let i = 0; i < sortedGroups.length; i++) {
    const root = find(i);
    const cluster = clusters.get(root) ?? [];
    cluster.push(...sortedGroups[i]);
    clusters.set(root, cluster);
  }
  return Array.from(clusters.values());
}

// A series with no new occurrence for more than this many cycles is
// treated as cancelled/lapsed rather than still active - e.g. a monthly
// charge (~30 day gap) that hasn't recurred in 2+ months. `now` is a
// parameter (defaulting to the real clock) so this stays testable/pure,
// same convention as date-presets.ts's resolveDatePreset(key, now).
const STALE_CYCLE_MULTIPLIER = 2;

export function detectRecurringSeries(rows: RecurringCandidateRow[], now: Date = new Date()): RecurringSeries[] {
  const groups = new Map<string, RecurringCandidateRow[]>();
  for (const row of rows) {
    const key = recurringGroupKey(row.accountInternalId, row.label);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const series: RecurringSeries[] = [];
  for (const group of mergeRenamedGroups(Array.from(groups.values()))) {
    if (group.length < MIN_OCCURRENCES) continue;

    const sorted = [...group].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(differenceInCalendarDays(new Date(sorted[i].bookingDate), new Date(sorted[i - 1].bookingDate)));
    }
    const avgGap = average(gaps);
    const gapStddev = stddev(gaps, avgGap);
    // Tolerance scales with cadence - a weekly charge landing on Friday one
    // week and Monday the next has a tighter absolute tolerance than a
    // yearly one shifting by a few days around a weekend.
    if (gapStddev > Math.max(4, avgGap * 0.25)) continue;

    const band = CADENCE_BANDS.find((b) => avgGap >= b.min && avgGap <= b.max);
    if (!band) continue;

    const last = sorted[sorted.length - 1];

    // Cancelled subscriptions still show up here otherwise - they have a
    // real occurrence history, just no *recent* one - so this has to be
    // measured from `now`, not from anything in `gaps`.
    const daysSinceLast = differenceInCalendarDays(now, new Date(last.bookingDate));
    if (daysSinceLast > avgGap * STALE_CYCLE_MULTIPLIER) continue;

    const amount = Math.abs(last.amount);

    series.push({
      accountInternalId: last.accountInternalId,
      accountLabel: last.accountLabel,
      labelKey: recurringLabelKey(last.label),
      displayLabel: last.label,
      categoryName: last.categoryName,
      categoryColor: last.categoryColor,
      amount,
      monthlyEquivalent: Math.round(MONTHLY_EQUIVALENT[band.cadence](amount) * 100) / 100,
      cadence: band.cadence,
      occurrences: sorted.length,
      lastDate: last.bookingDate,
      nextExpectedDate: new Date(new Date(last.bookingDate).getTime() + avgGap * 86400000).toISOString(),
    });
  }

  return series.sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);
}
