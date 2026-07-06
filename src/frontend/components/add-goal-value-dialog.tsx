"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addSavingsGoalValue } from "@/lib/actions";

export function AddGoalValueDialog({
  goalId,
  currentValue,
  currency,
}: {
  goalId: number;
  currentValue: number;
  currency: string;
}) {
  const t = useTranslations("goals");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(String(currentValue));

  function handleSave() {
    const parsedValue = Number(value.replace(",", "."));
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      toast.error(t("invalidValue"));
      return;
    }

    startTransition(async () => {
      try {
        await addSavingsGoalValue(goalId, parsedValue, currency);
        toast.success(t("progressUpdateSuccess"));
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("progressUpdateError"));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setValue(String(currentValue));
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <TrendingUp className="size-4" />
        {t("updateProgress")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newProgress")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="new-goal-value">{t("savedCurrency", { currency })}</Label>
          <Input
            id="new-goal-value"
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isPending}>
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
