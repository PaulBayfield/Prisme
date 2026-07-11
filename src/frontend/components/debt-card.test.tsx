import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeGetTranslations } from "@/test/mock-translations";
import type { Debt } from "@/lib/types";

vi.mock("next-intl/server", () => ({
  getTranslations: makeGetTranslations(),
}));

const getDisplayCurrency = vi.fn();
vi.mock("@/lib/display-currency", () => ({
  getDisplayCurrency: () => getDisplayCurrency(),
}));

import { DebtCard } from "./debt-card";

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 1,
    name: "Prêt immobilier",
    type: "mortgage",
    notes: null,
    value: 150000,
    valueCurrency: "EUR",
    valuedAt: "2026-01-01",
    ...overrides,
  };
}

describe("DebtCard", () => {
  it("shows the translated label for the debt's type", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "EUR", rate: 1 });
    render(await DebtCard({ debt: makeDebt({ type: "credit_card" }) }));

    expect(screen.getByText("credit_card")).toBeInTheDocument();
    expect(document.querySelector("svg.lucide-credit-card")).toBeInTheDocument();
  });

  it("falls back to the 'other' type definition for an unknown type value", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "EUR", rate: 1 });
    render(await DebtCard({ debt: makeDebt({ type: "not-a-real-type" }) }));

    expect(screen.getByText("other")).toBeInTheDocument();
  });

  it("formats the value using the resolved display currency and rate", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "USD", rate: 0.5 });
    render(await DebtCard({ debt: makeDebt({ value: 100 }) }));

    expect(screen.getByText(/50[,.]00/)).toBeInTheDocument();
  });

  it("links to the debt's detail page by id", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "EUR", rate: 1 });
    render(await DebtCard({ debt: makeDebt({ id: 9 }) }));

    expect(screen.getByRole("link")).toHaveAttribute("href", "/cash-debts/9");
  });
});
