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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateSavingsGoalDetails } from "@/lib/actions";
import type { Account, Category, SavingsGoal, SavingsGoalSource } from "@/lib/types";

type RecurringPeriod = "monthly" | "yearly";

// Sentinel for the category source's optional account filter - see
// create-goal-dialog.tsx for why this is a separate concept from the
// account source's (always-required) account selection.
const ALL_ACCOUNTS = "all";

export function EditGoalDialog({
  goal,
  categories,
  accounts,
}: {
  goal: SavingsGoal;
  categories: Category[];
  accounts: Account[];
}) {
  const t = useTranslations("goals");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(goal.name);
  const [source, setSource] = useState<SavingsGoalSource>(goal.source);
  const [recurringPeriod, setRecurringPeriod] = useState<RecurringPeriod>(
    goal.period === "yearly" ? "yearly" : "monthly",
  );
  const [targetAmount, setTargetAmount] = useState(String(goal.targetAmount));
  const [targetDate, setTargetDate] = useState(goal.targetDate?.slice(0, 10) ?? "");
  const [categoryId, setCategoryId] = useState<string>(
    goal.categoryId !== null ? String(goal.categoryId) : categories[0] ? String(categories[0].id) : "",
  );
  const [categoryAccountId, setCategoryAccountId] = useState<string>(
    goal.source === "category" && goal.accountInternalId ? goal.accountInternalId : ALL_ACCOUNTS,
  );
  const [accountInternalId, setAccountInternalId] = useState<string>(
    goal.source === "account" ? goal.accountInternalId ?? accounts[0]?.internalId ?? "" : accounts[0]?.internalId ?? "",
  );
  const [notes, setNotes] = useState(goal.notes ?? "");

  const SOURCE_LABELS: Record<SavingsGoalSource, string> = {
    manual: t("sourceLabels.manual"),
    category: t("sourceLabels.category"),
    account: t("sourceLabels.account"),
  };

  const RECURRING_PERIOD_LABELS: Record<RecurringPeriod, string> = {
    monthly: t("periodLabels.monthly"),
    yearly: t("periodLabels.yearly"),
  };

  function handleSave() {
    if (!name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }
    const parsedTarget = Number(targetAmount.replace(",", "."));
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      toast.error(t("invalidTargetAmount"));
      return;
    }
    if (source === "category" && !categoryId) {
      toast.error(t("chooseCategoryToTrack"));
      return;
    }
    if (source === "account" && !accountInternalId) {
      toast.error(t("chooseAccountToTrack"));
      return;
    }

    startTransition(async () => {
      try {
        await updateSavingsGoalDetails(goal.id, {
          name,
          targetAmount: parsedTarget,
          targetDate: source === "manual" || source === "account" ? targetDate || null : null,
          notes: notes || null,
          source,
          period: source === "category" ? recurringPeriod : "once",
          categoryId: source === "category" ? Number(categoryId) : null,
          accountInternalId:
            source === "account"
              ? accountInternalId
              : source === "category" && categoryAccountId !== ALL_ACCOUNTS
                ? categoryAccountId
                : null,
        });
        toast.success(t("updateSuccess"));
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("updateError"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil className="size-4" />
        {t("edit")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editGoal")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-goal-name">{t("name")}</Label>
            <Input id="edit-goal-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("tracking")}</Label>
            <div className="flex gap-2">
              {(Object.keys(SOURCE_LABELS) as SavingsGoalSource[]).map((sourceOption) => (
                <Button
                  key={sourceOption}
                  type="button"
                  size="sm"
                  variant={source === sourceOption ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSource(sourceOption)}
                >
                  {SOURCE_LABELS[sourceOption]}
                </Button>
              ))}
            </div>
          </div>

          {source === "category" ? (
            <div className="space-y-1.5">
              <Label>{t("period")}</Label>
              <div className="flex gap-2">
                {(Object.keys(RECURRING_PERIOD_LABELS) as RecurringPeriod[]).map((periodOption) => (
                  <Button
                    key={periodOption}
                    type="button"
                    size="sm"
                    variant={recurringPeriod === periodOption ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setRecurringPeriod(periodOption)}
                  >
                    {RECURRING_PERIOD_LABELS[periodOption]}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-goal-target">{t("targetAmount")}</Label>
              <Input
                id="edit-goal-target"
                inputMode="decimal"
                value={targetAmount}
                onChange={(event) => setTargetAmount(event.target.value)}
              />
            </div>
            {source === "manual" || source === "account" ? (
              <div className="space-y-1.5">
                <Label htmlFor="edit-goal-date">{t("targetDate")}</Label>
                <Input
                  id="edit-goal-date"
                  type="date"
                  value={targetDate}
                  onChange={(event) => setTargetDate(event.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>{t("trackedCategory")}</Label>
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("createCategoryFirst")}</p>
                ) : (
                  <Select
                    items={categories.map((category) => ({ value: String(category.id), label: category.name }))}
                    value={categoryId}
                    onValueChange={(next) => next && setCategoryId(next)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>

          {source === "category" && accounts.length > 0 ? (
            <div className="space-y-1.5">
              <Label>{t("accountOptional")}</Label>
              <Select
                items={[
                  { value: ALL_ACCOUNTS, label: t("allAccounts") },
                  ...accounts.map((account) => ({ value: account.internalId, label: account.label })),
                ]}
                value={categoryAccountId}
                onValueChange={(next) => next && setCategoryAccountId(next)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ACCOUNTS}>{t("allAccounts")}</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.internalId} value={account.internalId}>
                      {account.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {source === "account" ? (
            <div className="space-y-1.5">
              <Label>{t("trackedAccount")}</Label>
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noAccountsAvailable")}</p>
              ) : (
                <Select
                  items={accounts.map((account) => ({ value: account.internalId, label: account.label }))}
                  value={accountInternalId}
                  onValueChange={(next) => next && setAccountInternalId(next)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.internalId} value={account.internalId}>
                        {account.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="edit-goal-notes">{t("notes")}</Label>
            <Textarea
              id="edit-goal-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
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
