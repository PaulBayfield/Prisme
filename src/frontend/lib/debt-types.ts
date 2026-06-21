import { Banknote, CreditCard, Home, Package, type LucideIcon } from "lucide-react";

export interface DebtTypeDef {
  value: string;
  label: string;
  icon: LucideIcon;
}

export const DEBT_TYPES: DebtTypeDef[] = [
  { value: "mortgage", label: "Crédit immobilier", icon: Home },
  { value: "loan", label: "Prêt", icon: Banknote },
  { value: "credit_card", label: "Carte de crédit", icon: CreditCard },
  { value: "other", label: "Autre", icon: Package },
];

const FALLBACK_TYPE = DEBT_TYPES[DEBT_TYPES.length - 1];

export function getDebtTypeDef(value: string): DebtTypeDef {
  return DEBT_TYPES.find((type) => type.value === value) ?? FALLBACK_TYPE;
}
