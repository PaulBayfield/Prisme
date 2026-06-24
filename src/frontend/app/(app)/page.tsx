import Link from "next/link";
import { ArrowRight, Clock, Landmark, Vault, Wallet } from "lucide-react";

import { AccountCard } from "@/components/account-card";
import { BalanceChart } from "@/components/balance-chart";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionsTable } from "@/components/transactions-table";
import { getDateRangeFromCookies, rangeIncludesToday } from "@/lib/date-range";
import {
  getAccounts,
  getCashOnHand,
  getCategories,
  getCombinedBalanceHistory,
  getCurrentUserId,
  getPendingTransactions,
  getTotalAssetsValue,
  getTotalDebtsValue,
  getTotals,
  getTransactions,
} from "@/lib/data";
import { formatCurrency } from "@/lib/format";
import { getTransactionFiltersFromCookies } from "@/lib/transaction-filters";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const range = await getDateRangeFromCookies();
  const includesToday = rangeIncludesToday(range);
  const filters = await getTransactionFiltersFromCookies();

  const [accounts, totals, balanceHistory, transactions, pending, categories, totalAssets, totalDebts, cashOnHand] =
    await Promise.all([
      getAccounts(userId),
      getTotals(userId),
      getCombinedBalanceHistory(userId, range),
      getTransactions(userId, undefined, range, filters),
      includesToday ? getPendingTransactions(userId, undefined, filters) : Promise.resolve([]),
      getCategories(userId),
      getTotalAssetsValue(userId),
      getTotalDebtsValue(userId),
      getCashOnHand(userId),
    ]);

  const soldeTotal = totals.total + (cashOnHand?.value ?? 0);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Solde total"
          value={formatCurrency(soldeTotal)}
          icon={Wallet}
          hint={`${accounts.length} compte${accounts.length > 1 ? "s" : ""}`}
        />
        <KpiCard label="Comptes courants" value={formatCurrency(totals.current)} icon={Wallet} />
        <KpiCard label="Épargne" value={formatCurrency(totals.savings)} icon={Vault} />
        <KpiCard
          label="Patrimoine net"
          value={formatCurrency(soldeTotal + totalAssets - totalDebts)}
          icon={Landmark}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Évolution du solde</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceChart data={balanceHistory} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Comptes</h2>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/accounts" />}>
          Tout voir
          <ArrowRight className="size-4" />
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <AccountCard key={account.internalId} account={account} />
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
            Transactions récentes
          </CardTitle>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/transactions" />}>
            Tout voir
            <ArrowRight className="size-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <TransactionsTable
            transactions={transactions.slice(0, 6)}
            pending={pending}
            accounts={accounts}
            categories={categories}
          />
        </CardContent>
      </Card>
    </div>
  );
}
