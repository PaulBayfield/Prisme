import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Vault, Wallet } from "lucide-react";

import { BalanceChart } from "@/components/balance-chart";
import { KpiCard } from "@/components/kpi-card";
import { TransactionsTable } from "@/components/transactions-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDateRangeFromCookies, rangeIncludesToday } from "@/lib/date-range";
import {
  getAccountById,
  getAccounts,
  getBalanceHistory,
  getCategories,
  getCurrentUserId,
  getPendingTransactions,
  getTransactions,
} from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const account = await getAccountById(userId, id);

  if (!account) {
    notFound();
  }

  const range = await getDateRangeFromCookies();
  const includesToday = rangeIncludesToday(range);

  const [accounts, balanceHistory, transactions, pending, categories] = await Promise.all([
    getAccounts(userId),
    getBalanceHistory(account.internalId),
    getTransactions(userId, account.internalId, range),
    includesToday ? getPendingTransactions(userId, account.internalId) : Promise.resolve([]),
    getCategories(userId),
  ]);

  const Icon = account.type === "saving" ? Vault : Wallet;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/accounts" />}
      >
        <ArrowLeft className="size-4" />
        Comptes
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{account.label}</h2>
            <p className="blur-sensitive text-sm text-muted-foreground">{account.iban}</p>
          </div>
        </div>
        <Badge variant="secondary" className="w-fit capitalize">
          {account.type === "saving" ? "Épargne" : "Courant"}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          label="Solde actuel"
          value={formatCurrency(account.amount, account.amountCurrency)}
          icon={Icon}
        />
        <KpiCard label="Ouvert le" value={formatDate(account.accountCreationDate)} icon={Calendar} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Évolution du solde</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceChart
            data={balanceHistory.map((point) => ({ date: point.capturedAt, balance: point.amount }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionsTable
            transactions={transactions}
            pending={pending}
            accounts={accounts}
            categories={categories}
            showAccount={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
