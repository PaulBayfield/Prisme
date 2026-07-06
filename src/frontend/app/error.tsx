"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { OctagonXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-24 text-center">
      <OctagonXIcon className="size-8 text-destructive" />
      <p className="text-sm font-medium">{t("genericTitle")}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{t("genericDescription")}</p>
      <Button size="sm" className="mt-2" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
