import "server-only";

import { cookies } from "next/headers";

import type { DateRange } from "./types";

export const RANGE_COOKIE_NAME = "prisme-range";
// Distinguishes an explicit "Tout" (no filter) choice from the cookie never
// having been set at all - see getDateRangeCookieValue.
export const ALL_TIME_SENTINEL = "all";

// Inclusive calendar days ("from".."to", both included) - the more
// intuitive, user-facing shape. Converted here to the exclusive-`to`
// convention the data layer queries use internally (see getExpenseComparisons
// and friends in lib/data.ts).
export function parseDateRangeParams(params: { from?: string; to?: string }): DateRange {
  const from = params.from ? new Date(`${params.from}T00:00:00`) : null;
  const to = params.to ? new Date(`${params.to}T00:00:00`) : null;

  if (from === null || Number.isNaN(from.getTime()) || to === null || Number.isNaN(to.getTime())) {
    return { from: null, to: null };
  }

  to.setDate(to.getDate() + 1);
  return { from, to };
}

function toParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// First-of-month through today, inclusive - the same range as the header's
// "Ce mois-ci" preset. Used before the user has ever chosen a range, so a
// fresh visit doesn't query someone's entire transaction history.
function currentMonthToDate(): { from: string; to: string } {
  const now = new Date();
  return { from: toParam(new Date(now.getFullYear(), now.getMonth(), 1)), to: toParam(now) };
}

// The range picker lives in the site header, not in any one page's URL, so
// the selection is persisted as a cookie (set via setDateRangeCookie in
// lib/actions.ts) instead - that way it survives navigation to any page,
// including ones reached by means other than the sidebar/bottom nav links.
//
// Three distinct states share this one cookie: absent (never chosen - the
// caller gets the current-month default below), ALL_TIME_SENTINEL
// (explicitly chose "Tout", returned here as null), or an explicit
// "from|to" range.
export async function getDateRangeCookieValue(): Promise<{ from: string; to: string } | null> {
  const store = await cookies();
  const raw = store.get(RANGE_COOKIE_NAME)?.value;
  if (!raw) return currentMonthToDate();
  if (raw === ALL_TIME_SENTINEL) return null;

  const [from, to] = raw.split("|");
  return from && to ? { from, to } : currentMonthToDate();
}

export async function getDateRangeFromCookies(): Promise<DateRange> {
  const raw = await getDateRangeCookieValue();
  return parseDateRangeParams(raw ?? {});
}

// Whether `range` extends through the current moment - i.e. whether pending
// ("right now") transactions belong inside it. True for "Tout" (no filter)
// and any preset/range whose end is today or later (e.g. "Ce mois-ci" or
// "Aujourd'hui"), false for a strictly past range (e.g. "Mois dernier").
export function rangeIncludesToday(range: DateRange): boolean {
  return range.to === null || range.to.getTime() > Date.now();
}
