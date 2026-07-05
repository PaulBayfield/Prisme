"use server";

import { unstable_cache } from "next/cache";

import { CURRENCIES } from "./currencies";

export type ExchangeRates = {
  date: string;
  base: string;
  rates: Record<string, number>;
};

type FrankfurterRate = { date: string; base: string; quote: string; rate: number };

// Frankfurter (ECB-backed, api.frankfurter.dev) needs no API key and covers
// every currency in lib/currencies.ts - no per-user or demo-mode data is
// involved here, so unlike lib/actions.ts this doesn't need a real/demo split.
// Cached per base currency for an hour via unstable_cache so switching "De"
// repeatedly doesn't hammer the upstream API - ECB rates only publish once a
// day anyway.
const getCachedRates = unstable_cache(
  async (base: string): Promise<ExchangeRates> => {
    const quotes = CURRENCIES.map((currency) => currency.code).filter((code) => code !== base);
    const response = await fetch(`https://api.frankfurter.dev/v2/rates?base=${base}&quotes=${quotes.join(",")}`);

    if (!response.ok) {
      throw new Error("Impossible de récupérer les taux de change.");
    }

    const entries: FrankfurterRate[] = await response.json();
    return {
      date: entries[0]?.date ?? new Date().toISOString().slice(0, 10),
      base,
      rates: Object.fromEntries(entries.map((entry) => [entry.quote, entry.rate])),
    };
  },
  ["exchange-rates"],
  { revalidate: 3600 },
);

export async function getExchangeRates(base: string): Promise<ExchangeRates> {
  return getCachedRates(base);
}
