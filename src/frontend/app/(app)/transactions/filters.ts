export type Status = "all" | "processed" | "pending";

export const STATUS_LABEL_KEYS: Record<Status, string> = {
  all: "statusAll",
  processed: "statusProcessed",
  pending: "statusPending",
};

export function buildHref(status: Status): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  const qs = params.toString();
  return qs ? `/transactions?${qs}` : "/transactions";
}
