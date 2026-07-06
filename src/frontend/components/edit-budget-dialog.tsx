"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
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
import { setBudget } from "@/lib/actions";
import type { Budget } from "@/lib/types";

export function EditBudgetDialog({ budget }: { budget: Budget }) {
  const t = useTranslations("budgets");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(String(budget.amount));

  function handleSave() {
    const parsedAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error(t("invalidAmount"));
      return;
    }

    startTransition(async () => {
      try {
        await setBudget(budget.categoryId, parsedAmount);
        toast.success(t("updateSuccess"));
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("updateError"));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setAmount(String(budget.amount));
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Pencil className="size-3.5" />
        <span className="sr-only">{t("editButton")}</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editTitle", { name: budget.categoryName })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="edit-budget-amount">{t("monthlyAmount")}</Label>
          <Input
            id="edit-budget-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
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
