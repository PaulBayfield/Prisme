import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Calendar } from "lucide-react";

import { AddDebtValueDialog } from "@/components/add-debt-value-dialog";
import { BalanceChart } from "@/components/balance-chart";
import { DeleteDebtButton } from "@/components/delete-debt-button";
import { EditDebtDialog } from "@/components/edit-debt-dialog";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDebtTypeDef } from "@/lib/debt-types";
import { getDebtById, getDebtValueHistory, getCurrentUserId } from "@/lib/data";
import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function DebtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const debtId = Number(id);

  const debt = Number.isInteger(debtId) ? await getDebtById(userId, debtId) : undefined;
  if (!debt) {
    notFound();
  }

  const history = await getDebtValueHistory(debt.id);
  const { code, rate } = await getDisplayCurrency();
  const t = await getTranslations("cashDebts");
  const tDebtTypes = await getTranslations("debtTypes");
  const typeDef = getDebtTypeDef(debt.type);
  const Icon = typeDef.icon;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/cash-debts" />}
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Icon className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{debt.name}</h2>
            {debt.notes ? <p className="text-sm text-muted-foreground">{debt.notes}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{tDebtTypes(typeDef.labelKey)}</Badge>
          <EditDebtDialog debt={debt} />
          <DeleteDebtButton debtId={debt.id} name={debt.name} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label={t("remainingBalance")} value={formatCurrency(debt.value * rate, code)} icon={Icon} />
        <KpiCard label={t("lastUpdated")} value={formatDate(debt.valuedAt)} icon={Calendar} />
      </div>

      <div className="flex justify-end">
        <AddDebtValueDialog debtId={debt.id} currentValue={debt.value} currency={debt.valueCurrency} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("balanceEvolution")}</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceChart
            data={history.map((point) => ({ date: point.valuedAt, balance: point.value }))}
            label={t("balance")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
