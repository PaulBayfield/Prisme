import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { TransactionsTable } from "@/components/transactions-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDateRangeFromCookies, rangeIncludesToday } from "@/lib/date-range";
import { getAccounts, getCategories, getCurrentUserId, getPendingTransactions, getTransactions } from "@/lib/data";
import { getTransactionFiltersFromCookies } from "@/lib/transaction-filters";
import { buildHref, STATUS_LABEL_KEYS, type Status } from "./filters";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const resolvedParams = await searchParams;
  const statusFilter: Status =
    resolvedParams.status === "processed" || resolvedParams.status === "pending"
      ? resolvedParams.status
      : "all";
  const range = await getDateRangeFromCookies();
  const includesToday = rangeIncludesToday(range);
  const filters = await getTransactionFiltersFromCookies();

  const userId = await getCurrentUserId();
  const accounts = await getAccounts(userId);
  const categories = await getCategories(userId);

  const [transactions, pending] = await Promise.all([
    statusFilter === "pending" ? Promise.resolve([]) : getTransactions(userId, undefined, range, filters),
    statusFilter === "processed" || !includesToday
      ? Promise.resolve([])
      : getPendingTransactions(userId, undefined, filters),
  ]);

  const t = await getTranslations("transactions");

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex gap-2 overflow-x-auto">
        {(Object.keys(STATUS_LABEL_KEYS) as Status[]).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={statusFilter === status ? "default" : "outline"}
            nativeButton={false}
            render={<Link href={buildHref(status)} />}
          >
            {t(STATUS_LABEL_KEYS[status])}
          </Button>
        ))}
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
