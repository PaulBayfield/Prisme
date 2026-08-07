"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { undismissAlert } from "@/lib/actions";

export function UndismissAlertButton({ alertKey }: { alertKey: string }) {
  const t = useTranslations("alerts");
  const [isPending, startTransition] = useTransition();

  function handleUndismiss() {
    startTransition(async () => {
      try {
        await undismissAlert(alertKey);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("dismissError"));
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={handleUndismiss}>
      {t("reactivate")}
    </Button>
  );
}
