import { Banknote, Scale, TrendingDown } from "lucide-react";

import { AddCashValueDialog } from "@/components/add-cash-value-dialog";
import { AddVoucherValueDialog } from "@/components/add-voucher-value-dialog";
import { CreateDebtDialog } from "@/components/create-debt-dialog";
import { DebtCard } from "@/components/debt-card";
import { DualEvolutionChart } from "@/components/dual-evolution-chart";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDateRangeFromCookies } from "@/lib/date-range";
import {
  getCashHistory,
  getCashOnHand,
  getCombinedDebtValueHistory,
  getCurrentUserId,
  getDebts,
  getTotalDebtsValue,
  getTotals,
  getVoucherHistory,
  getVoucherOnHand,
} from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/format";

// Cash/voucher are raw snapshot timestamps while debt history is already
// truncated to midnight (date_trunc('day', ...) in getCombinedDebtValueHistory)
// - key all three by calendar day so a same-day update and debt sync land on
// one point instead of separate ones. Then carry the last known value
// forward into the gaps, rather than dropping to null between snapshots
// (which isn't what actually happened to the balance).
function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function mergeEvolution(
  cash: { date: string; balance: number }[],
  debt: { date: string; balance: number }[],
  voucher: { date: string; balance: number }[],
): { date: string; cash?: number; debt?: number; voucher?: number }[] {
  const cashByDay = new Map(cash.map((point) => [dayKey(point.date), point.balance]));
  const debtByDay = new Map(debt.map((point) => [dayKey(point.date), point.balance]));
  const voucherByDay = new Map(voucher.map((point) => [dayKey(point.date), point.balance]));
  const days = Array.from(new Set([...cashByDay.keys(), ...debtByDay.keys(), ...voucherByDay.keys()])).sort();

  let lastCash: number | undefined;
  let lastDebt: number | undefined;
  let lastVoucher: number | undefined;
  return days.map((day) => {
    if (cashByDay.has(day)) lastCash = cashByDay.get(day);
    if (debtByDay.has(day)) lastDebt = debtByDay.get(day);
    if (voucherByDay.has(day)) lastVoucher = voucherByDay.get(day);
    return { date: day, cash: lastCash, debt: lastDebt, voucher: lastVoucher };
  });
}

export default async function CashDebtsPage() {
  const userId = await getCurrentUserId();
  const range = await getDateRangeFromCookies();
  const [accountTotals, cashOnHand, cashHistory, voucherOnHand, voucherHistory, debts, totalDebts, debtHistory] =
    await Promise.all([
      getTotals(userId),
      getCashOnHand(userId),
      getCashHistory(userId, range),
      getVoucherOnHand(userId),
      getVoucherHistory(userId, range),
      getDebts(userId),
      getTotalDebtsValue(userId),
      getCombinedDebtValueHistory(userId, range),
    ]);

  const cashValue = cashOnHand?.value ?? 0;
  const cashCurrency = cashOnHand?.valueCurrency ?? "EUR";
  const voucherValue = voucherOnHand?.value ?? 0;
  const voucherCurrency = voucherOnHand?.valueCurrency ?? "EUR";
  const treasury = accountTotals.total + cashValue + voucherValue;
  const net = treasury - totalDebts;
  const evolution = mergeEvolution(
    cashHistory.map((point) => ({ date: point.valuedAt, balance: point.value })),
    debtHistory,
    voucherHistory.map((point) => ({ date: point.valuedAt, balance: point.value })),
  );

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Espèces & Dettes</h2>
        <CreateDebtDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Trésorerie" value={formatCurrency(treasury)} icon={Banknote} />
        <KpiCard label="Dettes" value={formatCurrency(totalDebts)} icon={TrendingDown} />
        <KpiCard label="Net" value={formatCurrency(net)} icon={Scale} />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Espèces en main</CardTitle>
            <AddCashValueDialog currentValue={cashValue} currency={cashCurrency} />
          </CardHeader>
          <CardContent>
            <div className="blur-sensitive text-2xl font-semibold tabular-nums">
              {formatCurrency(cashValue, cashCurrency)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {cashOnHand ? `Mis à jour le ${formatDate(cashOnHand.valuedAt)}` : "Jamais mis à jour"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Chèques vacances</CardTitle>
            <AddVoucherValueDialog currentValue={voucherValue} currency={voucherCurrency} />
          </CardHeader>
          <CardContent>
            <div className="blur-sensitive text-2xl font-semibold tabular-nums">
              {formatCurrency(voucherValue, voucherCurrency)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {voucherOnHand ? `Mis à jour le ${formatDate(voucherOnHand.valuedAt)}` : "Jamais mis à jour"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Évolution espèces & dettes</CardTitle>
        </CardHeader>
        <CardContent>
          <DualEvolutionChart
            data={evolution}
            series={[
              { key: "cash", label: "Espèces", color: "var(--chart-2)" },
              { key: "voucher", label: "Chèques vacances", color: "var(--chart-3)" },
              { key: "debt", label: "Dettes", color: "var(--destructive)" },
            ]}
          />
        </CardContent>
      </Card>

      {debts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm font-medium">Aucune dette pour le moment</p>
          <p className="text-xs text-muted-foreground">
            Ajoutez un prêt, un crédit immobilier ou une carte de crédit pour les suivre ici.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {debts.map((debt) => (
            <DebtCard key={debt.id} debt={debt} />
          ))}
        </div>
      )}
    </div>
  );
}
