// Pure date-bucketing math shared between the real (Postgres) and demo
// (in-memory) data layers - lib/data.real.ts and lib/demo/data.ts both
// aggregate per-transaction amounts into day/week/month/year buckets for the
// category evolution chart, and need to agree on exactly where each bucket
// starts and how the timeline is filled in between.

import { addDays, addMonths, addWeeks, addYears, startOfDay, startOfMonth, startOfWeek, startOfYear } from "date-fns";

import type { EvolutionGranularity } from "./types";

// The app's date formatting (lib/format.ts) is hardcoded to fr-FR, where
// weeks start on Monday.
const WEEK_STARTS_ON = 1 as const;

export function bucketStart(date: Date, granularity: EvolutionGranularity): Date {
  switch (granularity) {
    case "day":
      return startOfDay(date);
    case "week":
      return startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
    case "month":
      return startOfMonth(date);
    case "year":
      return startOfYear(date);
  }
}

function nextBucketStart(date: Date, granularity: EvolutionGranularity): Date {
  switch (granularity) {
    case "day":
      return addDays(date, 1);
    case "week":
      return addWeeks(date, 1);
    case "month":
      return addMonths(date, 1);
    case "year":
      return addYears(date, 1);
  }
}

// Every bucket the chart's x-axis should show, in chronological order - so
// a quiet period with zero activity still appears as a 0 instead of
// silently vanishing from the timeline. Computed from `from`/`to` when the
// range is bounded; when it isn't (the "Tout" / all-time case, both null),
// falls back to the earliest/latest date with actual activity.
export function enumerateBuckets(
  from: Date | null,
  to: Date | null,
  granularity: EvolutionGranularity,
  fallbackActivityDates: Date[],
): Date[] {
  let start: Date;
  let end: Date;

  if (from && to) {
    start = bucketStart(from, granularity);
    // `to` is exclusive (see parseDateRangeParams) - the instant just
    // before it is the actual last moment covered by the range.
    end = bucketStart(new Date(to.getTime() - 1), granularity);
  } else if (fallbackActivityDates.length > 0) {
    const sorted = [...fallbackActivityDates].sort((a, b) => a.getTime() - b.getTime());
    start = bucketStart(sorted[0], granularity);
    end = bucketStart(sorted[sorted.length - 1], granularity);
  } else {
    return [];
  }

  const buckets: Date[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = nextBucketStart(cursor, granularity)) {
    buckets.push(cursor);
  }
  return buckets;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Picks a sensible granularity for the active date range, so e.g. "Ce
// mois-ci" (~30 days) starts on "week" instead of a cramped 30-bar/point
// "day" view - same idea for every other preset, scaled by its actual span
// rather than hardcoded per preset. Only used as the *default*; the
// evolution chart's toggle still lets the user override it explicitly.
export function defaultGranularityForRange(from: Date | null, to: Date | null): EvolutionGranularity {
  // "Tout" (all-time, both null) - the span isn't known without querying
  // the data first, so fall back to the same default as a bounded range of
  // moderate length.
  if (!from || !to) return "month";

  const days = (to.getTime() - from.getTime()) / MS_PER_DAY;
  if (days <= 10) return "day";
  if (days <= 45) return "week";
  if (days <= 450) return "month";
  return "year";
}
