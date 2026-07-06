"use client";

import { useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { requestSync } from "@/lib/actions";
import type { SyncStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SyncNowButton({
  latestStatus,
  isDemoMode,
}: {
  latestStatus: SyncStatus | null;
  isDemoMode?: boolean;
}) {
  const t = useTranslations("syncStatus");
  const [isRequesting, startTransition] = useTransition();
  const router = useRouter();

  const isActive = latestStatus?.status === "pending" || latestStatus?.status === "running";

  // Same reasoning as SyncStatusButton in the header - the worker can take
  // longer than one tick to finish, so keep refreshing while a run is in
  // flight instead of looking stuck until the next navigation.
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

  if (!isDemoMode) {
    return (
      <Button variant="outline" onClick={handleClick} disabled={busy}>
        <RefreshCw className={cn("size-4", busy && "animate-spin")} />
        {t("launchSync")}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="outline" disabled />}>
        <RefreshCw className="size-4" />
        {t("launchSync")}
      </TooltipTrigger>
      <TooltipContent>{t("unavailableInDemo")}</TooltipContent>
    </Tooltip>
  );
}
