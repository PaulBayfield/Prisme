"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryPicker } from "@/components/category-picker";
import { useDisplayCurrency } from "@/components/display-currency-provider";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Account, Category, PendingTransaction, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TransactionsTableProps {
  transactions: Transaction[];
  pending?: PendingTransaction[];
  accounts: Account[];
  categories: Category[];
  showAccount?: boolean;
}

type Row = (Transaction & { status: "processed" }) | (PendingTransaction & { status: "pending" });

export function TransactionsTable({
  transactions,
  pending = [],
  accounts,
  categories,
  showAccount = true,
}: TransactionsTableProps) {
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);
  const { code, rate } = useDisplayCurrency();
  const t = useTranslations("transactions");

  const accountLabel = (id: string) =>
    accounts.find((account) => account.internalId === id)?.shortLabel ?? id;

  const allRows: Row[] = [
    ...pending.map((transaction) => ({ ...transaction, status: "pending" as const })),
    ...transactions.map((transaction) => ({ ...transaction, status: "processed" as const })),
  ].sort((a, b) => new Date(b.bookingDateTime).getTime() - new Date(a.bookingDateTime).getTime());

  // Pending rows can't be categorized yet, so they're not affected by this
  // filter - it only ever hides/shows processed rows by whether they have
  // any category assigned.
  const rows = uncategorizedOnly
    ? allRows.filter((row) => row.status === "pending" || row.categories.length === 0)
    : allRows;

  const uncategorizedCount = allRows.filter(
    (row) => row.status === "processed" && row.categories.length === 0,
  ).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("count", { count: rows.length })}</p>
        <Button
          variant={uncategorizedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setUncategorizedOnly((current) => !current)}
        >
          <Tag className="size-4" />
          {t("uncategorizedOnly")}
          {uncategorizedCount > 0 ? (
            <Badge variant={uncategorizedOnly ? "secondary" : "outline"}>{uncategorizedCount}</Badge>
          ) : null}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm font-medium">
            {uncategorizedOnly ? t("emptyUncategorized") : t("empty")}
          </p>
          <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("label")}</TableHead>
                {showAccount ? <TableHead className="hidden sm:table-cell">{t("account")}</TableHead> : null}
                <TableHead className="hidden sm:table-cell">{t("date")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`${row.status}-${row.accountInternalId}-${row.id}-${index}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="blur-sensitive font-medium">{row.label}</span>
                      {row.status === "pending" ? (
                        <Badge variant="outline" className="text-xs">
                          {t("statusPending")}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground sm:hidden">
                      {showAccount ? `${accountLabel(row.accountInternalId)} · ` : ""}
                      {formatDate(row.bookingDateTime)}
                    </p>
                    {row.status === "processed" ? (
                      <div className="mt-1.5">
                        <CategoryPicker
                          rowId={row.rowId}
                          assigned={row.categories}
                          categories={categories}
                          predictedCategories={row.predictedCategories}
                        />
                      </div>
                    ) : null}
                  </TableCell>
                  {showAccount ? (
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {accountLabel(row.accountInternalId)}
                    </TableCell>
                  ) : null}
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {formatDate(row.bookingDateTime)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "blur-sensitive text-right font-medium tabular-nums",
                      row.amount >= 0 ? "text-positive" : "text-negative",
                    )}
                  >
                    {row.amount >= 0 ? "+" : ""}
                    {formatCurrency(row.amount * rate, code)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
