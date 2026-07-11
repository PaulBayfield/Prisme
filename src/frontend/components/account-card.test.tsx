import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeGetTranslations } from "@/test/mock-translations";
import type { Account } from "@/lib/types";

vi.mock("next-intl/server", () => ({
  getTranslations: makeGetTranslations(),
}));

const getDisplayCurrency = vi.fn();
vi.mock("@/lib/display-currency", () => ({
  getDisplayCurrency: () => getDisplayCurrency(),
}));

import { AccountCard } from "./account-card";

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    internalId: "acc-1",
    label: "Compte courant",
    shortLabel: "CC",
    type: "current",
    iban: "FR76 0000 0000 0000 0000",
    amount: 1234.5,
    amountCurrency: "EUR",
    userRole: "OWNER",
    holderLabel: "M. Dupont",
    bankCode: "30002",
    agencyCode: "00550",
    productType: "CCHQ",
    accountCreationDate: "2020-01-01",
    bankLabel: null,
    status: null,
    ...overrides,
  };
}

describe("AccountCard", () => {
  it("renders a current account with the 'currentType' label and wallet icon", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "EUR", rate: 1 });
    render(await AccountCard({ account: makeAccount({ type: "current" }) }));

    expect(screen.getByText("currentType")).toBeInTheDocument();
    expect(screen.queryByText("savingsType")).not.toBeInTheDocument();
    expect(document.querySelector("svg.lucide-wallet")).toBeInTheDocument();
    expect(document.querySelector("svg.lucide-vault")).not.toBeInTheDocument();
  });

  it("renders a savings account with the 'savingsType' label and vault icon", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "EUR", rate: 1 });
    render(await AccountCard({ account: makeAccount({ type: "saving" }) }));

    expect(screen.getByText("savingsType")).toBeInTheDocument();
    expect(document.querySelector("svg.lucide-vault")).toBeInTheDocument();
  });

  it("omits the bank badge when bankLabel is null", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "EUR", rate: 1 });
    render(await AccountCard({ account: makeAccount({ bankLabel: null }) }));

    expect(screen.queryByText("Boursorama")).not.toBeInTheDocument();
  });

  it("shows the bank badge when bankLabel is present", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "EUR", rate: 1 });
    render(await AccountCard({ account: makeAccount({ bankLabel: "Boursorama" }) }));

    expect(screen.getByText("Boursorama")).toBeInTheDocument();
  });

  it("shows the active badge only when status is SUCCES", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "EUR", rate: 1 });
    const { rerender } = render(await AccountCard({ account: makeAccount({ status: "SUCCES" }) }));
    expect(screen.getByText("active")).toBeInTheDocument();

    rerender(await AccountCard({ account: makeAccount({ status: "ECHEC" }) }));
    expect(screen.queryByText("active")).not.toBeInTheDocument();

    rerender(await AccountCard({ account: makeAccount({ status: null }) }));
    expect(screen.queryByText("active")).not.toBeInTheDocument();
  });

  it("formats the amount using the resolved display currency and rate", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "USD", rate: 2 });
    render(await AccountCard({ account: makeAccount({ amount: 100 }) }));

    // 100 EUR * rate 2 formatted as USD via fr-FR Intl.NumberFormat.
    expect(screen.getByText(/200[,.]00/)).toBeInTheDocument();
  });

  it("links to the account's detail page by internalId", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "EUR", rate: 1 });
    render(await AccountCard({ account: makeAccount({ internalId: "acc-42" }) }));

    expect(screen.getByRole("link")).toHaveAttribute("href", "/accounts/acc-42");
  });
});
