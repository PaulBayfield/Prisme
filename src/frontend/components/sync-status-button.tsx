"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { requestSync } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import type { SyncStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<SyncStatus["status"], string> = {
  pending: "Synchronisation en attente",
  running: "Synchronisation en cours",
  success: "Dernière synchronisation réussie",
  error: "Dernière synchronisation échouée",
};

export function SyncStatusButton({ initialStatus }: { initialStatus: SyncStatus | null }) {
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
        toast.success("Synchronisation demandée");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors de la demande");
      }
    });
  }

  const busy = isRequesting || isActive;

  let label = "Actualiser mes données";
  if (initialStatus) {
    label = STATUS_LABEL[initialStatus.status];
    if (initialStatus.status === "error" && initialStatus.error) {
      label += ` : ${initialStatus.error}`;
    } else if (initialStatus.finishedAt) {
      label += ` · ${formatDateTime(initialStatus.finishedAt)}`;
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            onClick={handleClick}
            disabled={busy}
            aria-label="Actualiser mes données"
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
