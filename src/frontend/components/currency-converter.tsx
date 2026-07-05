"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currencies";
import { getExchangeRates, type ExchangeRates } from "@/lib/exchange-rate";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const CURRENCY_ITEMS = CURRENCIES.map((currency) => ({
  value: currency.code,
  label: `${currency.code} — ${currency.label}`,
}));

export function CurrencyConverter() {
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState("EUR");
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const result = await getExchangeRates(from);
        setRates(result);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors de la récupération des taux");
      }
    });
  }, [from]);

  const parsedAmount = Number(amount.replace(",", "."));
  const isAmountValid = Number.isFinite(parsedAmount) && parsedAmount >= 0;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Convertisseur de devises</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="currency-amount">Montant</Label>
            <Input
              id="currency-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label>De</Label>
            <Select items={CURRENCY_ITEMS} value={from} onValueChange={(next) => next && setFrom(next)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.code} — {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!isAmountValid ? (
        <p className="text-sm text-destructive">Montant invalide</p>
      ) : !rates ? (
        <p className="text-sm text-muted-foreground">Chargement des taux...</p>
      ) : (
        <div className={cn("space-y-3 transition-opacity", isPending && "opacity-50")}>
          <p className="text-xs text-muted-foreground">Taux du {formatDate(rates.date)}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {CURRENCIES.filter((currency) => currency.code !== from).map((currency) => {
              const rate = rates.rates[currency.code];
              return (
                <Card key={currency.code} size="sm">
                  <CardContent className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{currency.code}</p>
                      <p className="truncate text-xs text-muted-foreground">{currency.label}</p>
                    </div>
                    <p className="text-lg font-semibold tabular-nums">
                      {rate !== undefined ? formatCurrency(parsedAmount * rate, currency.code) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      1 {from} = {rate ?? "—"} {currency.code}
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
