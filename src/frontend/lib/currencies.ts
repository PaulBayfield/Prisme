export type Currency = { code: string };

// Display names live in messages/{locale}.json's "currencies" namespace,
// keyed by ISO code - callers translate it themselves (useTranslations
// client-side, getTranslations server-side), same pattern as
// lib/asset-types.ts's labelKey.
export const CURRENCIES: Currency[] = [
  { code: "EUR" },
  { code: "USD" },
  { code: "GBP" },
  { code: "CHF" },
  { code: "JPY" },
  { code: "CAD" },
  { code: "AUD" },
  { code: "CNY" },
  { code: "SEK" },
  { code: "NOK" },
  { code: "PLN" },
  { code: "TRY" },
  { code: "INR" },
  { code: "BRL" },
  { code: "MXN" },
  { code: "SGD" },
  { code: "HKD" },
  { code: "NZD" },
  { code: "ZAR" },
  { code: "KRW" },
];
