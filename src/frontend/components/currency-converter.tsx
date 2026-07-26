"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currencies";
import { getExchangeRates, type ExchangeRates } from "@/lib/exchange-rate";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CurrencyConverter() {
  const t = useTranslations("currencyExchange");
  const tCommon = useTranslations("common");
  const tCurrencies = useTranslations("currencies");
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState("EUR");
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  // Distinct from `rates` staying null - without it, a failed fetch left the
  // UI stuck on "Chargement des taux..." forever (the only feedback was a
  // toast, easy to miss/dismiss), which read as the page being frozen.
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  const CURRENCY_ITEMS = CURRENCIES.map((currency) => ({
    value: currency.code,
    label: `${currency.code} — ${tCurrencies(currency.code)}`,
  }));

  function loadRates() {
    startTransition(async () => {
      try {
        const result = await getExchangeRates(from);
        setRates(result);
        setError(false);
      } catch (err) {
        setError(true);
        toast.error(err instanceof Error ? err.message : t("genericError"));
      }
    });
  }

  useEffect(() => {
    loadRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fetch when the base currency changes, not on every t()/loadRates identity change
  }, [from]);

  const parsedAmount = Number(amount.replace(",", "."));
  const isAmountValid = Number.isFinite(parsedAmount) && parsedAmount >= 0;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{t("converterTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="currency-amount">{t("amount")}</Label>
            <Input
              id="currency-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label>{t("from")}</Label>
            <Select items={CURRENCY_ITEMS} value={from} onValueChange={(next) => next && setFrom(next)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.code} — {tCurrencies(currency.code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!isAmountValid ? (
        <p className="text-sm text-destructive">{t("invalidAmount")}</p>
      ) : error && !rates ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-destructive">{t("genericError")}</p>
          <Button variant="outline" size="sm" disabled={isPending} onClick={loadRates}>
            {tCommon("retry")}
          </Button>
        </div>
      ) : !rates ? (
        <p className="text-sm text-muted-foreground">{t("loadingRates")}</p>
      ) : (
        <div className={cn("space-y-3 transition-opacity", isPending && "opacity-50")}>
          <p className="text-xs text-muted-foreground">{t("ratesAsOf", { date: formatDate(rates.date) })}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {CURRENCIES.filter((currency) => currency.code !== from).map((currency) => {
              const rate = rates.rates[currency.code];
              return (
                <Card key={currency.code} size="sm">
                  <CardContent className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{currency.code}</p>
                      <p className="truncate text-xs text-muted-foreground">{tCurrencies(currency.code)}</p>
                    </div>
                    <p className="text-lg font-semibold tabular-nums">
                      {rate !== undefined ? formatCurrency(parsedAmount * rate, currency.code) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {t("rateLine", { from, rate: rate ?? "—", to: currency.code })}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
