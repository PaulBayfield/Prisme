"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, Banknote, Check, ListFilter, Search, Tag, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { setTransactionFiltersCookie } from "@/lib/actions";
import type { Account, Category, TransactionFilters, TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

// Duplicated rather than imported from lib/transaction-filters.ts, which is
// "server-only" - same reasoning as toParam in time-range-picker.tsx.
const EMPTY_FILTERS: TransactionFilters = {
  categoryIds: [],
  type: "all",
  accountIds: [],
  amountMin: null,
  amountMax: null,
  search: "",
};

function countActiveFilters(filters: TransactionFilters): number {
  let count = 0;
  if (filters.categoryIds.length > 0) count++;
  if (filters.type !== "all") count++;
  if (filters.accountIds.length > 0) count++;
  if (filters.amountMin !== null || filters.amountMax !== null) count++;
  if (filters.search.trim() !== "") count++;
  return count;
}

function FilterSection({
  icon: Icon,
  label,
  count,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card/50 p-3">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3.5 text-muted-foreground" />
        <p className="text-sm font-medium">{label}</p>
        {count ? <Badge variant="secondary">{count}</Badge> : null}
      </div>
      {children}
    </div>
  );
}

interface TransactionFiltersSheetProps {
  accounts: Account[];
  categories: Category[];
  initialFilters: TransactionFilters;
}

export function TransactionFiltersSheet({ accounts, categories, initialFilters }: TransactionFiltersSheetProps) {
  const t = useTranslations("transactionFilters");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<TransactionFilters>(initialFilters);
  const [categoryQuery, setCategoryQuery] = useState("");

  const TYPE_LABELS: Record<TransactionType, string> = {
    all: t("typeAll"),
    income: t("typeIncome"),
    expense: t("typeExpense"),
  };

  useEffect(() => {
    // Committed filters changed from outside this component (applied here
    // then round-tripped back down through the layout as a new prop, or
    // cleared elsewhere) - resync the draft so reopening the sheet reflects
    // the real state rather than a stale edit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(initialFilters);
  }, [initialFilters]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setDraft(initialFilters);
      setCategoryQuery("");
    }
  }

  function apply(next: TransactionFilters) {
    startTransition(async () => {
      await setTransactionFiltersCookie(next);
      setOpen(false);
    });
  }

  function toggleCategory(id: number) {
    setDraft((current) => ({
      ...current,
      categoryIds: current.categoryIds.includes(id)
        ? current.categoryIds.filter((categoryId) => categoryId !== id)
        : [...current.categoryIds, id],
    }));
  }

  function toggleAccount(internalId: string) {
    setDraft((current) => ({
      ...current,
      accountIds: current.accountIds.includes(internalId)
        ? current.accountIds.filter((accountId) => accountId !== internalId)
        : [...current.accountIds, internalId],
    }));
  }

  const normalizedCategoryQuery = categoryQuery.trim().toLowerCase();
  const filteredCategories = normalizedCategoryQuery
    ? categories.filter((category) => category.name.toLowerCase().includes(normalizedCategoryQuery))
    : categories;

  const activeCount = countActiveFilters(initialFilters);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={<Button variant="outline" size="default" />}>
        <ListFilter className="size-4" />
        <span className="hidden sm:inline">{t("trigger")}</span>
        {activeCount > 0 ? <Badge variant="secondary">{activeCount}</Badge> : null}
      </SheetTrigger>
      {/*
        No overflow-y-auto here - the popup itself must stay pinned to the
        viewport so the header and footer (Appliquer/Réinitialiser) never
        scroll out of view. Only the filter list below scrolls (min-h-0 is
        required for that flex child to actually shrink instead of pushing
        the whole popup taller than the screen on mobile).
        Width is set inline rather than via Tailwind's data-[side=right]:w-3/4
        base class - twMerge can't be relied on to override a data-attribute-
        scoped utility from a plain className override.
      */}
      <SheetContent side="right" style={{ width: "min(92vw, 24rem)" }}>
        <SheetHeader className="shrink-0">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4">
          <FilterSection icon={ArrowLeftRight} label={t("type")}>
            <div className="flex gap-2">
              {(Object.keys(TYPE_LABELS) as TransactionType[]).map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant={draft.type === type ? "default" : "outline"}
                  className="min-w-0 flex-1 overflow-hidden"
                  onClick={() => setDraft((current) => ({ ...current, type }))}
                >
                  {TYPE_LABELS[type]}
                </Button>
              ))}
            </div>
          </FilterSection>

          <FilterSection icon={Banknote} label={t("amount")}>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                placeholder={t("min")}
                value={draft.amountMin ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    amountMin: event.target.value === "" ? null : Number(event.target.value),
                  }))
                }
              />
              <span className="text-muted-foreground">—</span>
              <Input
                type="number"
                inputMode="decimal"
                placeholder={t("max")}
                value={draft.amountMax ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    amountMax: event.target.value === "" ? null : Number(event.target.value),
                  }))
                }
              />
            </div>
          </FilterSection>

          <FilterSection icon={Search} label={t("search")}>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={draft.search}
                onChange={(event) => setDraft((current) => ({ ...current, search: event.target.value }))}
                className="pl-7"
              />
            </div>
          </FilterSection>

          <FilterSection icon={Wallet} label={t("accounts")} count={draft.accountIds.length || undefined}>
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noAccounts")}</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {accounts.map((account) => {
                  const isSelected = draft.accountIds.includes(account.internalId);
                  return (
                    <button
                      key={account.internalId}
                      type="button"
                      onClick={() => toggleAccount(account.internalId)}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Check className={cn("size-3.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                      {account.label}
                    </button>
                  );
                })}
              </div>
            )}
          </FilterSection>

          <FilterSection icon={Tag} label={t("categories")} count={draft.categoryIds.length || undefined}>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noCategories")}</p>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t("searchCategoriesPlaceholder")}
                    value={categoryQuery}
                    onChange={(event) => setCategoryQuery(event.target.value)}
                    className="pl-7"
                  />
                </div>
                <ScrollArea className="h-56">
                  <div className="flex flex-col gap-0.5 pr-1">
                    {filteredCategories.length === 0 ? (
                      <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("noResults")}</p>
                    ) : (
                      filteredCategories.map((category) => {
                        const isSelected = draft.categoryIds.includes(category.id);
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => toggleCategory(category.id)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted",
                              category.parentId !== null && "pl-6",
                            )}
                          >
                            <Check className={cn("size-3.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: category.effectiveColor }}
                            />
                            {category.name}
                          </button>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </FilterSection>
        </div>

        <SheetFooter className="shrink-0 flex-row">
          <Button variant="outline" className="flex-1" disabled={isPending} onClick={() => apply(EMPTY_FILTERS)}>
            {t("reset")}
          </Button>
          <Button className="flex-1" disabled={isPending} onClick={() => apply(draft)}>
            {t("apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
