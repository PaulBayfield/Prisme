"use client";

import { useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { requestSync } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import type { SyncStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SyncStatusButton({
  initialStatus,
  isDemoMode,
}: {
  initialStatus: SyncStatus | null;
  isDemoMode?: boolean;
}) {
  const t = useTranslations("syncStatus");
  const [isRequesting, startTransition] = useTransition();
  const router = useRouter();

  const isActive = initialStatus?.status === "pending" || initialStatus?.status === "running";

  // requestSync()'s revalidatePath refreshes this on click, but the worker
  // can take longer than one tick to actually finish the sync - keep
  // refreshing while pending/running so the status updates on its own
  // once it settles, instead of looking stuck until the next navigation.
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [isActive, router]);

  function handleClick() {
    startTransition(async () => {
      try {
        await requestSync();
        toast.success(t("requestSuccess"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("requestError"));
      }
    });
  }

  const busy = isRequesting || isActive;

  const STATUS_LABEL: Record<SyncStatus["status"], string> = {
    pending: t("pending"),
    running: t("running"),
    success: t("success"),
    error: t("error"),
  };

  let label = t("refreshData");
  if (initialStatus) {
    label = STATUS_LABEL[initialStatus.status];
    if (initialStatus.status === "error" && initialStatus.error) {
      label += ` : ${initialStatus.error}`;
    } else if (initialStatus.finishedAt) {
      label += ` · ${formatDateTime(initialStatus.finishedAt)}`;
    }
  }
  if (isDemoMode) {
    label = t("unavailableInDemo");
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            onClick={handleClick}
            disabled={busy || isDemoMode}
            aria-label={isDemoMode ? t("unavailableInDemo") : t("refreshData")}
          />
        }
      >
        <RefreshCw
          className={cn(
            "size-4",
            busy && "animate-spin",
            initialStatus?.status === "error" && !busy && "text-destructive",
          )}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
