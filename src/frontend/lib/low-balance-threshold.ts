import "server-only";

import { cookies } from "next/headers";

// A user-configurable "low balance" alert threshold (in EUR, the currency
// every stored amount is in - see lib/display-currency.ts), same
// cookie-based settings pattern as the display currency. Set from
// Settings > Alertes (setLowBalanceThresholdCookie).
export const LOW_BALANCE_THRESHOLD_COOKIE = "prisme-low-balance-threshold";
export const DEFAULT_LOW_BALANCE_THRESHOLD = 100;

export async function getLowBalanceThreshold(): Promise<number> {
  const store = await cookies();
  const raw = store.get(LOW_BALANCE_THRESHOLD_COOKIE)?.value;
  if (!raw) return DEFAULT_LOW_BALANCE_THRESHOLD;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_LOW_BALANCE_THRESHOLD;
}
