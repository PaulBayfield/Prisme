import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Calendar } from "lucide-react";

import { AddAssetValueDialog } from "@/components/add-asset-value-dialog";
import { BalanceChart } from "@/components/balance-chart";
import { DeleteAssetButton } from "@/components/delete-asset-button";
import { EditAssetDialog } from "@/components/edit-asset-dialog";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAssetTypeDef } from "@/lib/asset-types";
import { getAssetById, getAssetValueHistory, getCurrentUserId } from "@/lib/data";
import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const assetId = Number(id);

  const asset = Number.isInteger(assetId) ? await getAssetById(userId, assetId) : undefined;
  if (!asset) {
    notFound();
  }

  const history = await getAssetValueHistory(asset.id);
  const { code, rate } = await getDisplayCurrency();
  const t = await getTranslations("patrimoine");
  const tAssetTypes = await getTranslations("assetTypes");
  const typeDef = getAssetTypeDef(asset.type);
  const Icon = typeDef.icon;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        nativeButton={false}
        render={<Link href="/patrimoine" />}
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{asset.name}</h2>
            {asset.notes ? <p className="text-sm text-muted-foreground">{asset.notes}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{tAssetTypes(typeDef.labelKey)}</Badge>
          <EditAssetDialog asset={asset} />
          <DeleteAssetButton assetId={asset.id} name={asset.name} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label={t("currentValue")} value={formatCurrency(asset.value * rate, code)} icon={Icon} />
        <KpiCard label={t("lastUpdated")} value={formatDate(asset.valuedAt)} icon={Calendar} />
      </div>

      <div className="flex justify-end">
        <AddAssetValueDialog assetId={asset.id} currentValue={asset.value} currency={asset.valueCurrency} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("valueEvolution")}</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceChart
            data={history.map((point) => ({ date: point.valuedAt, balance: point.value }))}
            label={t("value")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
