import { buildTransactionsCsv } from "@/lib/csv";
import { getAccounts, getCurrentUserId, getTransactions } from "@/lib/data";
import { getDateRangeFromCookies } from "@/lib/date-range";
import { getTransactionFiltersFromCookies } from "@/lib/transaction-filters";

export async function GET() {
  const userId = await getCurrentUserId();
  const range = await getDateRangeFromCookies();
  const filters = await getTransactionFiltersFromCookies();
  const [transactions, accounts] = await Promise.all([
    getTransactions(userId, undefined, range, filters),
    getAccounts(userId),
  ]);

  const accountLabelById = new Map(accounts.map((account) => [account.internalId, account.label]));
  const csv = buildTransactionsCsv(transactions, accountLabelById);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="transactions.csv"',
    },
  });
}
