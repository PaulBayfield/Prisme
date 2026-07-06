import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Clock, Landmark, Vault, Wallet } from "lucide-react";

import { AccountCard } from "@/components/account-card";
import { BalanceChart } from "@/components/balance-chart";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionsTable } from "@/components/transactions-table";
import { getDateRangeFromCookies, rangeIncludesToday } from "@/lib/date-range";
import { getDisplayCurrency } from "@/lib/display-currency";
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
  getVoucherOnHand,
} from "@/lib/data";
import { formatCurrency } from "@/lib/format";
import { getTransactionFiltersFromCookies } from "@/lib/transaction-filters";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();
  const range = await getDateRangeFromCookies();
  const includesToday = rangeIncludesToday(range);
  const filters = await getTransactionFiltersFromCookies();
  const { code, rate } = await getDisplayCurrency();
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");

  const [
    accounts,
    totals,
    balanceHistory,
    transactions,
    pending,
    categories,
    totalAssets,
    totalDebts,
    cashOnHand,
    voucherOnHand,
  ] = await Promise.all([
    getAccounts(userId),
    getTotals(userId),
    getCombinedBalanceHistory(userId, range),
    getTransactions(userId, undefined, range, filters),
    includesToday ? getPendingTransactions(userId, undefined, filters) : Promise.resolve([]),
    getCategories(userId),
    getTotalAssetsValue(userId),
    getTotalDebtsValue(userId),
    getCashOnHand(userId),
    getVoucherOnHand(userId),
  ]);

  const cashValue = cashOnHand?.value ?? 0;
  const voucherValue = voucherOnHand?.value ?? 0;
  const soldeTotal = totals.total + cashValue + voucherValue;
  const patrimoineNet = soldeTotal + totalAssets - totalDebts;

  const currentAccounts = accounts.filter((account) => account.type === "current");
  const savingsAccounts = accounts.filter((account) => account.type === "saving");

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t("totalBalance")}
          value={formatCurrency(soldeTotal * rate, code)}
          icon={Wallet}
          hint={t("accountsHint", { count: accounts.length })}
          details={[
            { label: t("currentAccounts"), value: formatCurrency(totals.current * rate, code) },
            { label: t("savings"), value: formatCurrency(totals.savings * rate, code) },
            { label: t("cash"), value: formatCurrency(cashValue * rate, code) },
            { label: t("vouchers"), value: formatCurrency(voucherValue * rate, code) },
          ]}
        />
        <KpiCard
          label={t("currentAccounts")}
          value={formatCurrency(totals.current * rate, code)}
          icon={Wallet}
          details={currentAccounts.map((account) => ({
            label: account.shortLabel,
            value: formatCurrency(account.amount * rate, code),
          }))}
        />
        <KpiCard
          label={t("savings")}
          value={formatCurrency(totals.savings * rate, code)}
          icon={Vault}
          details={savingsAccounts.map((account) => ({
            label: account.label,
            value: formatCurrency(account.amount * rate, code),
          }))}
        />
        <KpiCard
          label={t("netWorth")}
          value={formatCurrency(patrimoineNet * rate, code)}
          icon={Landmark}
          details={[
            { label: t("totalBalance"), value: formatCurrency(soldeTotal * rate, code) },
            { label: t("assets"), value: formatCurrency(totalAssets * rate, code) },
            { label: t("debts"), value: `-${formatCurrency(totalDebts * rate, code)}` },
          ]}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("balanceEvolution")}</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceChart data={balanceHistory} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("accounts")}</h2>
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/accounts" />}>
          {tCommon("seeAll")}
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
            {t("recentTransactions")}
          </CardTitle>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/transactions" />}>
            {tCommon("seeAll")}
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
