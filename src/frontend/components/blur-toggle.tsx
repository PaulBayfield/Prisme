"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { useBlur } from "@/components/blur-provider";
import { Button } from "@/components/ui/button";

export function BlurToggle() {
  const t = useTranslations("settings");
  const { blurred, toggle } = useBlur();

  return (
    <Button variant="outline" size="icon" aria-label={t("privacy.hideAmountsLabel")} onClick={toggle}>
      {blurred ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </Button>
  );
}
