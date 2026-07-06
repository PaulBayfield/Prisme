import { getTranslations } from "next-intl/server";
import { CheckCircle2, CircleDashed, RefreshCw, XCircle } from "lucide-react";

import { SyncNowButton } from "@/components/sync-now-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUserId, getSyncRequests } from "@/lib/data";
import { isDemoMode } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import type { SyncStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

function StatusBadge({ status, label }: { status: SyncStatus["status"]; label: string }) {
  if (status === "success") {
    return (
      <Badge className="border-transparent bg-positive/10 text-positive">
        <CheckCircle2 className="size-3" />
        {label}
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive">
        <XCircle className="size-3" />
        {label}
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge variant="outline">
        <RefreshCw className="size-3 animate-spin" />
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <CircleDashed className="size-3" />
      {label}
    </Badge>
  );
}

// Both timestamps come from the same sync_requests row, so this is purely
// presentational rounding - never NaN/negative outside of clock skew.
function formatDuration(startIso: string, endIso: string): string {
  const seconds = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default async function MonitoringPage() {
  const userId = await getCurrentUserId();
  const syncRequests = await getSyncRequests(userId);
  const latestStatus = syncRequests[0] ?? null;
  const t = await getTranslations("monitoring");

  const STATUS_LABELS: Record<SyncStatus["status"], string> = {
    pending: t("statusPending"),
    running: t("statusRunning"),
    success: t("statusSuccess"),
    error: t("statusError"),
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <SyncNowButton latestStatus={latestStatus} isDemoMode={isDemoMode} />
      </div>

      <Card>
        <CardContent>
          {syncRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
              <p className="text-sm font-medium">{t("empty")}</p>
              <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("requestedOn")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("startedOn")}</TableHead>
                    <TableHead>{t("finishedOn")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("duration")}</TableHead>
                    <TableHead>{t("detail")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncRequests.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <StatusBadge status={run.status} label={STATUS_LABELS[run.status]} />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {formatDateTime(run.requestedAt)}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {run.startedAt ? formatDateTime(run.startedAt) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {run.finishedAt ? formatDateTime(run.finishedAt) : "—"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {run.startedAt && run.finishedAt ? formatDuration(run.startedAt, run.finishedAt) : "—"}
                      </TableCell>
                      <TableCell className={cn(run.status === "error" && "text-destructive")}>
                        {run.error ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
