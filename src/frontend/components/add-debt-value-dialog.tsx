"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { TrendingDown } from "lucide-react";
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
import { addDebtValue } from "@/lib/actions";

export function AddDebtValueDialog({
  debtId,
  currentValue,
  currency,
}: {
  debtId: number;
  currentValue: number;
  currency: string;
}) {
  const t = useTranslations("cashDebts");
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
        await addDebtValue(debtId, parsedValue, currency);
        toast.success(t("balanceUpdateSuccess"));
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("balanceUpdateError"));
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
        <TrendingDown className="size-4" />
        {t("updateBalance")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newBalance")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="new-debt-value">{t("remainingBalanceCurrency", { currency })}</Label>
          <Input
            id="new-debt-value"
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
