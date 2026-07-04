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

const STATUS_LABELS: Record<SyncStatus["status"], string> = {
  pending: "En attente",
  running: "En cours",
  success: "Réussi",
  error: "Échoué",
};

function StatusBadge({ status }: { status: SyncStatus["status"] }) {
  if (status === "success") {
    return (
      <Badge className="border-transparent bg-positive/10 text-positive">
        <CheckCircle2 className="size-3" />
        {STATUS_LABELS[status]}
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive">
        <XCircle className="size-3" />
        {STATUS_LABELS[status]}
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge variant="outline">
        <RefreshCw className="size-3 animate-spin" />
        {STATUS_LABELS[status]}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <CircleDashed className="size-3" />
      {STATUS_LABELS[status]}
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

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Monitoring</h2>
        <SyncNowButton latestStatus={latestStatus} isDemoMode={isDemoMode} />
      </div>

      <Card>
        <CardContent>
          {syncRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-12 text-center">
              <p className="text-sm font-medium">Aucune synchronisation pour le moment</p>
              <p className="text-xs text-muted-foreground">
                Lancez une synchronisation pour voir apparaître son résultat ici.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden sm:table-cell">Demandée le</TableHead>
                    <TableHead className="hidden sm:table-cell">Démarrée le</TableHead>
                    <TableHead>Terminée le</TableHead>
                    <TableHead className="hidden md:table-cell">Durée</TableHead>
                    <TableHead>Détail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncRequests.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <StatusBadge status={run.status} />
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
