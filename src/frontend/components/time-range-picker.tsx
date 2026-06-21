"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange as DayPickerRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setDateRangeCookie } from "@/lib/actions";
import { formatDate } from "@/lib/format";

interface InclusiveRange {
  from: Date;
  to: Date;
}

interface Preset {
  label: string;
  range: () => InclusiveRange;
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

const PRESETS: Preset[] = [
  {
    label: "Aujourd'hui",
    range: () => ({ from: startOfDay(new Date()), to: startOfDay(new Date()) }),
  },
  {
    label: "7 derniers jours",
    range: () => ({ from: addDays(startOfDay(new Date()), -6), to: startOfDay(new Date()) }),
  },
  {
    label: "30 derniers jours",
    range: () => ({ from: addDays(startOfDay(new Date()), -29), to: startOfDay(new Date()) }),
  },
  {
    label: "Ce mois-ci",
    range: () => {
      const now = new Date();
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: startOfDay(now) };
    },
  },
  {
    label: "Mois dernier",
    range: () => {
      const now = new Date();
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0),
      };
    },
  },
  {
    label: "Cette année",
    range: () => {
      const now = new Date();
      return { from: new Date(now.getFullYear(), 0, 1), to: startOfDay(now) };
    },
  },
  {
    label: "Année dernière",
    range: () => {
      const now = new Date();
      return { from: new Date(now.getFullYear() - 1, 0, 1), to: new Date(now.getFullYear() - 1, 11, 31) };
    },
  },
];

function toParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TimeRangePicker({ initialRange }: { initialRange: { from: string; to: string } | null }) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const from = initialRange ? new Date(`${initialRange.from}T00:00:00`) : undefined;
  const to = initialRange ? new Date(`${initialRange.to}T00:00:00`) : undefined;

  const [draft, setDraft] = React.useState<DayPickerRange | undefined>(from && to ? { from, to } : undefined);

  React.useEffect(() => {
    // Keep the in-popover draft selection in sync if the range changes from
    // outside the calendar (e.g. cleared elsewhere, cookie expired).
    // Recomputed from the same initialRange fields rather than closing over
    // from/to directly, since those are new Date objects every render.
    const nextFrom = initialRange ? new Date(`${initialRange.from}T00:00:00`) : undefined;
    const nextTo = initialRange ? new Date(`${initialRange.to}T00:00:00`) : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(nextFrom && nextTo ? { from: nextFrom, to: nextTo } : undefined);
    // initialRange itself is a new object every render - depend on its
    // primitive fields instead, or this would fire every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRange?.from, initialRange?.to]);

  function applyRange(range: InclusiveRange | null) {
    startTransition(async () => {
      await setDateRangeCookie(range ? toParam(range.from) : null, range ? toParam(range.to) : null);
      setOpen(false);
    });
  }

  function matchesPreset(preset: Preset): boolean {
    if (!from || !to) return false;
    const presetRange = preset.range();
    return toParam(presetRange.from) === toParam(from) && toParam(presetRange.to) === toParam(to);
  }

  const activePreset = PRESETS.find(matchesPreset);
  const label =
    !from || !to
      ? "Tout"
      : activePreset
        ? activePreset.label
        : `${formatDate(from.toISOString())} - ${formatDate(to.toISOString())}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="default" />} disabled={isPending}>
        <CalendarIcon className="size-4" />
        <span className="hidden sm:inline">{label}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-col gap-0.5 border-b p-2 sm:w-44 sm:border-b-0 sm:border-r">
            <Button
              variant={!from && !to ? "secondary" : "ghost"}
              size="sm"
              className="justify-start"
              disabled={isPending}
              onClick={() => applyRange(null)}
            >
              Tout
            </Button>
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant={activePreset?.label === preset.label ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                disabled={isPending}
                onClick={() => applyRange(preset.range())}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-2 p-2">
            <Calendar mode="range" selected={draft} onSelect={setDraft} numberOfMonths={2} defaultMonth={from} />
            <Button
              size="sm"
              disabled={isPending || !draft?.from || !draft?.to}
              onClick={() => draft?.from && draft.to && applyRange({ from: draft.from, to: draft.to })}
            >
              Appliquer
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
