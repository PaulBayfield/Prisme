"use client";

import { useState, useTransition } from "react";
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

const SOURCE_LABELS: Record<SavingsGoalSource, string> = {
  manual: "Manuel",
  category: "Par catégorie",
  account: "Par compte",
};

type RecurringPeriod = "monthly" | "yearly";

const RECURRING_PERIOD_LABELS: Record<RecurringPeriod, string> = {
  monthly: "Mensuel",
  yearly: "Annuel",
};

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

  function handleSave() {
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    const parsedTarget = Number(targetAmount.replace(",", "."));
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      toast.error("Montant cible invalide");
      return;
    }
    if (source === "category" && !categoryId) {
      toast.error("Choisissez une catégorie à suivre");
      return;
    }
    if (source === "account" && !accountInternalId) {
      toast.error("Choisissez un compte à suivre");
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
        toast.success("Objectif mis à jour");
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors de la mise à jour");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil className="size-4" />
        Modifier
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier l&apos;objectif</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-goal-name">Nom</Label>
            <Input id="edit-goal-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Suivi</Label>
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
              <Label>Période</Label>
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
              <Label htmlFor="edit-goal-target">Montant cible (€)</Label>
              <Input
                id="edit-goal-target"
                inputMode="decimal"
                value={targetAmount}
                onChange={(event) => setTargetAmount(event.target.value)}
              />
            </div>
            {source === "manual" || source === "account" ? (
              <div className="space-y-1.5">
                <Label htmlFor="edit-goal-date">Date cible (optionnel)</Label>
                <Input
                  id="edit-goal-date"
                  type="date"
                  value={targetDate}
                  onChange={(event) => setTargetDate(event.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Catégorie suivie</Label>
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Créez d&apos;abord une catégorie</p>
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
              <Label>Compte (optionnel)</Label>
              <Select
                items={[
                  { value: ALL_ACCOUNTS, label: "Tous les comptes" },
                  ...accounts.map((account) => ({ value: account.internalId, label: account.label })),
                ]}
                value={categoryAccountId}
                onValueChange={(next) => next && setCategoryAccountId(next)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ACCOUNTS}>Tous les comptes</SelectItem>
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
              <Label>Compte suivi</Label>
              {accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun compte disponible</p>
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
            <Label htmlFor="edit-goal-notes">Notes</Label>
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
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
