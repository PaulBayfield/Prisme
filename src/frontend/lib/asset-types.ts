import { Car, Gem, Home, Package, TrendingUp, type LucideIcon } from "lucide-react";

export interface AssetTypeDef {
  value: string;
  label: string;
  icon: LucideIcon;
}

export const ASSET_TYPES: AssetTypeDef[] = [
  { value: "real_estate", label: "Immobilier", icon: Home },
  { value: "vehicle", label: "Véhicule", icon: Car },
  { value: "investment", label: "Investissement", icon: TrendingUp },
  { value: "valuable", label: "Objet de valeur", icon: Gem },
  { value: "other", label: "Autre", icon: Package },
];

const FALLBACK_TYPE = ASSET_TYPES[ASSET_TYPES.length - 1];

export function getAssetTypeDef(value: string): AssetTypeDef {
  return ASSET_TYPES.find((type) => type.value === value) ?? FALLBACK_TYPE;
}
