import type { Transaction } from "./types";

// RFC4180: quote a field if it contains the delimiter, a quote, or a
// newline, doubling any internal quotes.
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const HEADER = ["Date", "Compte", "Libelle", "Montant", "Devise", "Categories"];

export function buildTransactionsCsv(transactions: Transaction[], accountLabelById: Map<string, string>): string {
  const lines = [HEADER.join(",")];
  for (const transaction of transactions) {
    const row = [
      transaction.bookingDateTime.slice(0, 10),
      accountLabelById.get(transaction.accountInternalId) ?? transaction.accountInternalId,
      transaction.label,
      transaction.amount.toFixed(2),
      transaction.amountCurrency,
      transaction.categories.map((category) => category.name).join("; "),
    ];
    lines.push(row.map(csvField).join(","));
  }
  // BOM so Excel (which guesses encoding from the first bytes rather than
  // honoring the Content-Type header) renders accented labels correctly
  // instead of mojibake.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
