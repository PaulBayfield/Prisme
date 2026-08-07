// Pure date-range math shared between the client-side picker
// (components/time-range-picker.tsx) and the server-only cookie resolver
// (lib/date-range.ts). Deliberately has no "server-only" guard and no
// dependency on `next/headers` so it can be imported from both.
//
// Each preset's range() is a function of `now` rather than a precomputed
// {from, to} pair, precisely so it can be re-evaluated against the current
// date every time it's read (e.g. from the cookie, on a later day) instead
// of being frozen at the moment the user selected it.

export interface DateRangeValue {
  from: Date;
  to: Date;
}

export interface DatePreset {
  key: string;
  range: (now?: Date) => DateRangeValue;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export const DATE_PRESETS: DatePreset[] = [
  {
    key: "today",
    range: (now = new Date()) => ({ from: startOfDay(now), to: startOfDay(now) }),
  },
  {
    key: "last7Days",
    range: (now = new Date()) => ({ from: addDays(startOfDay(now), -6), to: startOfDay(now) }),
  },
  {
    key: "last30Days",
    range: (now = new Date()) => ({ from: addDays(startOfDay(now), -29), to: startOfDay(now) }),
  },
  {
    key: "thisMonth",
    range: (now = new Date()) => ({ from: new Date(now.getFullYear(), now.getMonth(), 1), to: startOfDay(now) }),
  },
  {
    key: "lastMonth",
    range: (now = new Date()) => ({
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to: new Date(now.getFullYear(), now.getMonth(), 0),
    }),
  },
  {
    key: "thisYear",
    range: (now = new Date()) => ({ from: new Date(now.getFullYear(), 0, 1), to: startOfDay(now) }),
  },
  {
    key: "lastYear",
    range: (now = new Date()) => ({
      from: new Date(now.getFullYear() - 1, 0, 1),
      to: new Date(now.getFullYear() - 1, 11, 31),
    }),
  },
];

export function resolveDatePreset(key: string, now = new Date()): DateRangeValue | null {
  return DATE_PRESETS.find((preset) => preset.key === key)?.range(now) ?? null;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Shifts an explicit range to "the previous/next period of the same kind" -
// powers the time range picker's prev/next-period buttons. Infers the kind
// from the range's own shape rather than from which preset produced it (a
// range read back from the cookie has already lost that information, see
// date-range.ts): a range aligned to a full or month-to-date calendar
// month/year shifts by that calendar unit (so it lands on a real calendar
// month/year instead of an arbitrary same-length blob of days); anything
// else - a rolling window like "last 7 days" or a hand-picked custom range
// - shifts by its own exact span so its length is preserved.
export function shiftDateRange(range: DateRangeValue, direction: 1 | -1, today: Date = new Date()): DateRangeValue {
  const todayStart = startOfDay(today);
  const isMonthAligned =
    isSameDay(range.from, startOfMonth(range.from)) &&
    (isSameDay(range.to, endOfMonth(range.from)) || isSameDay(range.to, todayStart));
  const isYearAligned =
    isSameDay(range.from, startOfYear(range.from)) &&
    (isSameDay(range.to, endOfYear(range.from)) || isSameDay(range.to, todayStart));

  if (isYearAligned) {
    const from = startOfYear(addYears(range.from, direction));
    const fullTo = endOfYear(from);
    return { from, to: fullTo.getTime() > todayStart.getTime() ? todayStart : fullTo };
  }

  if (isMonthAligned) {
    const from = startOfMonth(addMonths(range.from, direction));
    const fullTo = endOfMonth(from);
    return { from, to: fullTo.getTime() > todayStart.getTime() ? todayStart : fullTo };
  }

  // Rolling window / custom range - shift by its own (inclusive) length.
  const spanDays = Math.round((startOfDay(range.to).getTime() - startOfDay(range.from).getTime()) / 86400000) + 1;
  return { from: addDays(range.from, direction * spanDays), to: addDays(range.to, direction * spanDays) };
}

// Whether the range already extends through today - shifting "next" from
// here would jump into a period that hasn't happened yet, so the picker
// disables its next-period button instead of calling this.
export function isLatestPeriod(range: DateRangeValue, today: Date = new Date()): boolean {
  return startOfDay(range.to).getTime() >= startOfDay(today).getTime();
}
