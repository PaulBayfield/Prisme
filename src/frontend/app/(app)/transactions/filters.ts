export type Status = "all" | "processed" | "pending";

export const STATUS_LABELS: Record<Status, string> = {
  all: "Toutes",
  processed: "Validées",
  pending: "En cours de traitement",
};

export function buildHref(account: string, status: Status): string {
  const params = new URLSearchParams();
  if (account !== "all") params.set("account", account);
  if (status !== "all") params.set("status", status);
  const qs = params.toString();
  return qs ? `/transactions?${qs}` : "/transactions";
}
