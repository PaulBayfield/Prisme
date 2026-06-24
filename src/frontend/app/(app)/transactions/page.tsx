import Link from "next/link";

import { AccountFilterSelect } from "@/components/account-filter-select";
import { TransactionsTable } from "@/components/transactions-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDateRangeFromCookies, rangeIncludesToday } from "@/lib/date-range";
import { getAccounts, getCategories, getCurrentUserId, getPendingTransactions, getTransactions } from "@/lib/data";
import { buildHref, STATUS_LABELS, type Status } from "./filters";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; status?: string }>;
}) {
  const resolvedParams = await searchParams;
  const accountFilter = resolvedParams.account ?? "all";
  const statusFilter: Status =
    resolvedParams.status === "processed" || resolvedParams.status === "pending"
      ? resolvedParams.status
      : "all";
  const range = await getDateRangeFromCookies();
  const includesToday = rangeIncludesToday(range);

  const userId = await getCurrentUserId();
  const accounts = await getAccounts(userId);
  const categories = await getCategories(userId);
  const accountId = accountFilter === "all" ? undefined : accountFilter;

  const [transactions, pending] = await Promise.all([
    statusFilter === "pending" ? Promise.resolve([]) : getTransactions(userId, accountId, range),
    statusFilter === "processed" || !includesToday ? Promise.resolve([]) : getPendingTransactions(userId, accountId),
  ]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {(Object.keys(STATUS_LABELS) as Status[]).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={statusFilter === status ? "default" : "outline"}
              nativeButton={false}
              render={<Link href={buildHref(accountFilter, status)} />}
            >
              {STATUS_LABELS[status]}
            </Button>
          ))}
        </div>

        <AccountFilterSelect accounts={accounts} accountFilter={accountFilter} statusFilter={statusFilter} />
      </div>

      <Card>
        <CardContent>
          <TransactionsTable
            transactions={transactions}
            pending={pending}
            accounts={accounts}
            categories={categories}
          />
        </CardContent>
      </Card>
    </div>
  );
}
