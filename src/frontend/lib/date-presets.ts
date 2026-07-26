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
