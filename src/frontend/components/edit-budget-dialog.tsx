"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { ColorPicker } from "@/components/color-picker";
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

// ColorPicker works with bare hex ("ef4444"), the DB stores "#ef4444".
const stripHash = (color: string) => color.replace(/^#/, "");

export function EditBudgetDialog({ budget }: { budget: Budget }) {
  const t = useTranslations("budgets");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(String(budget.amount));
  // null = follow the category's color.
  const [customColor, setCustomColor] = useState<string | null>(
    budget.customColor ? stripHash(budget.customColor) : null,
  );

  function handleSave() {
    const parsedAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error(t("invalidAmount"));
      return;
    }

    startTransition(async () => {
      try {
        await setBudget(budget.categoryId, parsedAmount, customColor ? `#${customColor}` : null);
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
        if (next) {
          setAmount(String(budget.amount));
          setCustomColor(budget.customColor ? stripHash(budget.customColor) : null);
        }
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
        <div className="flex flex-col gap-3">
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
          <div className="space-y-1.5">
            <Label>{t("color")}</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <ColorPicker value={customColor ?? stripHash(budget.categoryColor)} onChange={setCustomColor} />
              </div>
              {customColor !== null ? (
                <Button variant="ghost" size="icon-sm" onClick={() => setCustomColor(null)}>
                  <RotateCcw className="size-3.5" />
                  <span className="sr-only">{t("useCategoryColor")}</span>
                </Button>
              ) : null}
            </div>
          </div>
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
