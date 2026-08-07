"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setLowBalanceThresholdCookie } from "@/lib/actions";

// Shared by the Settings dialog (Alertes section) and the /alerts page, so
// the threshold can be adjusted from either place without duplicating the
// save logic.
export function LowBalanceThresholdForm({ initialValue }: { initialValue: number }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [value, setValue] = useState(String(initialValue));
  const [isPending, startTransition] = useTransition();

  function save() {
    const amount = Number(value);
    startTransition(async () => {
      try {
        await setLowBalanceThresholdCookie(amount);
        toast.success(t("alerts.saveSuccess"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : tCommon("genericError"));
      }
    });
  }

  return (
    <div className="space-y-2">
      <Label>{t("alerts.lowBalanceThreshold")}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          step={10}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={isPending}
          className="w-32"
        />
        <Button size="sm" onClick={save} disabled={isPending}>
          {tCommon("save")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("alerts.lowBalanceThresholdHint")}</p>
    </div>
  );
}
