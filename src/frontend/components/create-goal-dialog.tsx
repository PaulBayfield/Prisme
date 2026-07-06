"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { createSavingsGoal } from "@/lib/actions";
import type { Account, Category, SavingsGoalSource } from "@/lib/types";

type RecurringPeriod = "monthly" | "yearly";

// Sentinel for the category source's optional account filter - "no account
// selected" there means "all accounts", unlike the account source, where an
// account is always required (see ACCOUNT_SOURCE_DEFAULT_ID below).
const ALL_ACCOUNTS = "all";

export function CreateGoalDialog({ categories, accounts }: { categories: Category[]; accounts: Account[] }) {
  const t = useTranslations("goals");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [source, setSource] = useState<SavingsGoalSource>("manual");
  const [recurringPeriod, setRecurringPeriod] = useState<RecurringPeriod>("monthly");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [value, setValue] = useState("");
  const [categoryId, setCategoryId] = useState<string>(categories[0] ? String(categories[0].id) : "");
  const [categoryAccountId, setCategoryAccountId] = useState<string>(ALL_ACCOUNTS);
  const [accountInternalId, setAccountInternalId] = useState<string>(accounts[0]?.internalId ?? "");
  const [notes, setNotes] = useState("");

  const SOURCE_LABELS: Record<SavingsGoalSource, string> = {
    manual: t("sourceLabels.manual"),
    category: t("sourceLabels.category"),
    account: t("sourceLabels.account"),
  };

  const RECURRING_PERIOD_LABELS: Record<RecurringPeriod, string> = {
    monthly: t("periodLabels.monthly"),
    yearly: t("periodLabels.yearly"),
  };

  function reset() {
    setName("");
    setSource("manual");
    setRecurringPeriod("monthly");
    setTargetAmount("");
    setTargetDate("");
    setValue("");
    setCategoryAccountId(ALL_ACCOUNTS);
    setNotes("");
  }

  function handleCreate() {
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
    const parsedValue = value.trim() ? Number(value.replace(",", ".")) : 0;
    if (source === "manual" && (!Number.isFinite(parsedValue) || parsedValue < 0)) {
      toast.error(t("invalidValue"));
      return;
    }

    startTransition(async () => {
      try {
        const goalId = await createSavingsGoal({
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
          value: parsedValue,
          valueCurrency: "EUR",
        });
        toast.success(t("createSuccess"));
        setOpen(false);
        reset();
        router.push(`/goals/${goalId}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("createError"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        {t("addGoal")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newGoal")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">{t("name")}</Label>
            <Input
              id="goal-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("namePlaceholder")}
            />
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
              <Label htmlFor="goal-target">{t("targetAmount")}</Label>
              <Input
                id="goal-target"
                inputMode="decimal"
                value={targetAmount}
                onChange={(event) => setTargetAmount(event.target.value)}
                placeholder="3000"
              />
            </div>
            {source === "manual" || source === "account" ? (
              <div className="space-y-1.5">
                <Label htmlFor="goal-date">{t("targetDate")}</Label>
                <Input
                  id="goal-date"
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

          {source === "manual" ? (
            <div className="space-y-1.5">
              <Label htmlFor="goal-value">{t("alreadySaved")}</Label>
              <Input
                id="goal-value"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="0"
              />
            </div>
          ) : null}
          {source === "category" ? (
            <p className="text-xs text-muted-foreground">
              {categoryAccountId !== ALL_ACCOUNTS
                ? t("categoryProgressNoteWithAccount", {
                    account:
                      accounts.find((account) => account.internalId === categoryAccountId)?.label ??
                      t("thisAccount"),
                    frequency: recurringPeriod === "monthly" ? t("perMonth") : t("perYear"),
                  })
                : t("categoryProgressNoteNoAccount", {
                    frequency: recurringPeriod === "monthly" ? t("perMonth") : t("perYear"),
                  })}
            </p>
          ) : null}
          {source === "account" ? (
            <p className="text-xs text-muted-foreground">{t("accountProgressNote")}</p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="goal-notes">{t("notesOptional")}</Label>
            <Textarea
              id="goal-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={isPending}>
            {t("addGoal")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
