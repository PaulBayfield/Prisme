import { getTranslations } from "next-intl/server";
import { Landmark } from "lucide-react";

import { AssetCard } from "@/components/asset-card";
import { BalanceChart } from "@/components/balance-chart";
import { CreateAssetDialog } from "@/components/create-asset-dialog";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDateRangeFromCookies } from "@/lib/date-range";
import { getAssets, getCombinedAssetValueHistory, getCurrentUserId, getTotalAssetsValue } from "@/lib/data";
import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency } from "@/lib/format";

export default async function PatrimoinePage() {
  const userId = await getCurrentUserId();
  const range = await getDateRangeFromCookies();
  const { code, rate } = await getDisplayCurrency();
  const t = await getTranslations("patrimoine");
  const [assets, total, history] = await Promise.all([
    getAssets(userId),
    getTotalAssetsValue(userId),
    getCombinedAssetValueHistory(userId, range),
  ]);

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("overview")}</h2>
        <CreateAssetDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label={t("totalNetWorth")}
          value={formatCurrency(total * rate, code)}
          icon={Landmark}
          hint={t("assetsHint", { count: assets.length })}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("netWorthEvolution")}</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceChart data={history} label={t("value")} />
        </CardContent>
      </Card>

      {assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm font-medium">{t("empty")}</p>
          <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}
