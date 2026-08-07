"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Bell, Settings2, TrendingUp, Wallet, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Alert, AlertType } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALERT_ICON: Record<AlertType, LucideIcon> = {
  budgetExceeded: Wallet,
  lowBalance: AlertTriangle,
  unusualSpending: TrendingUp,
};

export function AlertsBell({ alerts }: { alerts: Alert[] }) {
  const t = useTranslations("alerts");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Navigating with next/link here is unreliable: the Popover portal can
  // unmount the anchor as part of the same click that's supposed to
  // trigger its navigation, silently swallowing it. Closing first, then
  // pushing imperatively, works regardless of that unmount timing.
  function goTo(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="icon" className="relative" />}>
        <Bell className="size-4" />
        {alerts.length > 0 ? (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            {alerts.length > 9 ? "9+" : alerts.length}
          </span>
        ) : null}
        <span className="sr-only">{t("trigger")}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">{t("title")}</p>
          {alerts.length > 0 ? <Badge variant="secondary">{alerts.length}</Badge> : null}
        </div>
        {alerts.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto p-1.5">
            {alerts.map((alert, index) => {
              const Icon = ALERT_ICON[alert.type];
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => goTo(alert.href)}
                  className="flex items-start gap-2 rounded-md p-2 text-left text-sm hover:bg-muted"
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      alert.severity === "critical" ? "text-destructive" : "text-amber-600 dark:text-amber-400",
                    )}
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-0.5">
                    <p className="blur-sensitive font-medium">{alert.title}</p>
                    <p className="blur-sensitive text-xs text-muted-foreground">{alert.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => goTo("/alerts")}
          className="flex items-center justify-center gap-1.5 border-t px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Settings2 className="size-3.5" aria-hidden="true" />
          {t("manage")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
