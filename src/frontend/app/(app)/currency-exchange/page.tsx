import { getTranslations } from "next-intl/server";

import { CurrencyConverter } from "@/components/currency-converter";

export default async function CurrencyExchangePage() {
  const t = await getTranslations("currencyExchange");

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <CurrencyConverter />
    </div>
  );
}
