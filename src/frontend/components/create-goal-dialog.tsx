"use client";

import { useState, useTransition } from "react";
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

// Sentinel for the category source's optional account filter - "no account
// selected" there means "all accounts", unlike the account source, where an
// account is always required (see ACCOUNT_SOURCE_DEFAULT_ID below).
const ALL_ACCOUNTS = "all";

export function CreateGoalDialog({ categories, accounts }: { categories: Category[]; accounts: Account[] }) {
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
    const parsedValue = value.trim() ? Number(value.replace(",", ".")) : 0;
    if (source === "manual" && (!Number.isFinite(parsedValue) || parsedValue < 0)) {
      toast.error("Valeur invalide");
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
        toast.success("Objectif ajouté");
        setOpen(false);
        reset();
        router.push(`/goals/${goalId}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors de la création");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        Ajouter un objectif
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvel objectif d&apos;épargne</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">Nom</Label>
            <Input
              id="goal-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Vacances d'été"
            />
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
              <Label htmlFor="goal-target">Montant cible (€)</Label>
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
                <Label htmlFor="goal-date">Date cible (optionnel)</Label>
                <Input
                  id="goal-date"
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

          {source === "manual" ? (
            <div className="space-y-1.5">
              <Label htmlFor="goal-value">Déjà épargné (€, optionnel)</Label>
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
              La progression sera calculée automatiquement à partir des transactions catégorisées
              {categoryAccountId !== ALL_ACCOUNTS
                ? ` sur ${accounts.find((account) => account.internalId === categoryAccountId)?.label ?? "ce compte"}`
                : ""}
              , chaque {recurringPeriod === "monthly" ? "mois" : "année"}.
            </p>
          ) : null}
          {source === "account" ? (
            <p className="text-xs text-muted-foreground">
              La progression sera calculée automatiquement à partir du solde actuel du compte.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="goal-notes">Notes (optionnel)</Label>
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
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
