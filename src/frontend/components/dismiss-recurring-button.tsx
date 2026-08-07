"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ignoreRecurringTransaction, unignoreRecurringTransaction } from "@/lib/actions";

export function DismissRecurringButton({
  accountInternalId,
  labelKey,
  label,
}: {
  accountInternalId: string;
  labelKey: string;
  label: string;
}) {
  const t = useTranslations("subscriptions");
  const [isPending, startTransition] = useTransition();

  function handleDismiss() {
    startTransition(async () => {
      try {
        await ignoreRecurringTransaction(accountInternalId, labelKey, label);
        toast.success(t("dismissSuccess"), {
          action: {
            label: t("undo"),
            onClick: () => {
              unignoreRecurringTransaction(accountInternalId, labelKey).catch(() =>
                toast.error(t("dismissError")),
              );
            },
          },
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("dismissError"));
      }
    });
  }

  return (
    <Button variant="ghost" size="icon-sm" disabled={isPending} onClick={handleDismiss}>
      <EyeOff className="size-3.5" />
      <span className="sr-only">{t("dismiss")}</span>
    </Button>
  );
}
