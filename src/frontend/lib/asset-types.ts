import { Car, Gem, Home, Package, TrendingUp, type LucideIcon } from "lucide-react";

export interface AssetTypeDef {
  value: string;
  labelKey: string;
  icon: LucideIcon;
}

// labelKey looks up messages/{locale}.json's "assetTypes" namespace - callers
// translate it themselves (useTranslations client-side, getTranslations
// server-side) since this plain array can't call hooks itself.
export const ASSET_TYPES: AssetTypeDef[] = [
  { value: "real_estate", labelKey: "real_estate", icon: Home },
  { value: "vehicle", labelKey: "vehicle", icon: Car },
  { value: "investment", labelKey: "investment", icon: TrendingUp },
  { value: "valuable", labelKey: "valuable", icon: Gem },
  { value: "other", labelKey: "other", icon: Package },
];

const FALLBACK_TYPE = ASSET_TYPES[ASSET_TYPES.length - 1];

export function getAssetTypeDef(value: string): AssetTypeDef {
  return ASSET_TYPES.find((type) => type.value === value) ?? FALLBACK_TYPE;
}
