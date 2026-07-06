import { Banknote, CreditCard, Home, Package, type LucideIcon } from "lucide-react";

export interface DebtTypeDef {
  value: string;
  labelKey: string;
  icon: LucideIcon;
}

// labelKey looks up messages/{locale}.json's "debtTypes" namespace - see
// lib/asset-types.ts for why this is a labelKey rather than a baked-in label.
export const DEBT_TYPES: DebtTypeDef[] = [
  { value: "mortgage", labelKey: "mortgage", icon: Home },
  { value: "loan", labelKey: "loan", icon: Banknote },
  { value: "credit_card", labelKey: "credit_card", icon: CreditCard },
  { value: "other", labelKey: "other", icon: Package },
];

const FALLBACK_TYPE = DEBT_TYPES[DEBT_TYPES.length - 1];

export function getDebtTypeDef(value: string): DebtTypeDef {
  return DEBT_TYPES.find((type) => type.value === value) ?? FALLBACK_TYPE;
}
