"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { CalendarIcon } from "lucide-react";
import type { DateRange as DayPickerRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setDateRangeCookie } from "@/lib/actions";
import { DATE_PRESETS, type DateRangeValue } from "@/lib/date-presets";
import { formatDate } from "@/lib/format";

function toParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TimeRangePicker({ initialRange }: { initialRange: { from: string; to: string } | null }) {
  const t = useTranslations("dateRange");
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

  function applyPreset(key: string) {
    startTransition(async () => {
      await setDateRangeCookie({ preset: key });
      setOpen(false);
    });
  }

  function applyCustomRange(range: DateRangeValue | null) {
    startTransition(async () => {
      await setDateRangeCookie(range ? { from: toParam(range.from), to: toParam(range.to) } : null);
      setOpen(false);
    });
  }

  function matchesPreset(preset: (typeof DATE_PRESETS)[number]): boolean {
    if (!from || !to) return false;
    // Presets are stored as their relative key and re-resolved server-side
    // against "now" on every read (see getDateRangeCookieValue in
    // lib/date-range.ts), so recomputing here against the current moment
    // and comparing to the resolved initialRange still matches correctly
    // even on a day after the preset was originally selected.
    const presetRange = preset.range();
    return toParam(presetRange.from) === toParam(from) && toParam(presetRange.to) === toParam(to);
  }

  const activePreset = DATE_PRESETS.find(matchesPreset);
  const label =
    !from || !to
      ? t("all")
      : activePreset
        ? t(`presets.${activePreset.key}`)
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
              onClick={() => applyCustomRange(null)}
            >
              {t("all")}
            </Button>
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                variant={activePreset?.key === preset.key ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                disabled={isPending}
                onClick={() => applyPreset(preset.key)}
              >
                {t(`presets.${preset.key}`)}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-2 p-2">
            <Calendar mode="range" selected={draft} onSelect={setDraft} numberOfMonths={2} defaultMonth={from} />
            <Button
              size="sm"
              disabled={isPending || !draft?.from || !draft?.to}
              onClick={() => draft?.from && draft.to && applyCustomRange({ from: draft.from, to: draft.to })}
            >
              {t("apply")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
