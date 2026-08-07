"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { unignoreRecurringTransaction } from "@/lib/actions";

export function UnignoreRecurringButton({
  accountInternalId,
  labelKey,
}: {
  accountInternalId: string;
  labelKey: string;
}) {
  const t = useTranslations("subscriptions");
  const [isPending, startTransition] = useTransition();

  function handleUnignore() {
    startTransition(async () => {
      try {
        await unignoreRecurringTransaction(accountInternalId, labelKey);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("dismissError"));
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={handleUnignore}>
      {t("reactivate")}
    </Button>
  );
}
