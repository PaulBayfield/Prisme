import type { EvolutionGranularity } from "./types";

export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
}

export function getCurrencySymbol(currency: string): string {
  const part = new Intl.NumberFormat("fr-FR", { style: "currency", currency })
    .formatToParts(0)
    .find((entry) => entry.type === "currency");
  return part?.value ?? currency;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// Formats a bucket's start date for the evolution chart's axis/tooltip -
// "day"/"week" buckets are dense enough to need the day, "month"/"year"
// buckets don't (every point already falls on the 1st).
export function formatEvolutionDate(iso: string, granularity: EvolutionGranularity): string {
  const date = new Date(iso);
  switch (granularity) {
    case "day":
    case "week":
      return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date);
    case "month":
      return new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" }).format(date);
    case "year":
      return new Intl.DateTimeFormat("fr-FR", { year: "numeric" }).format(date);
  }
}
