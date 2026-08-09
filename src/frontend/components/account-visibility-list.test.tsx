import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeUseTranslations } from "@/test/mock-translations";
import type { Account } from "@/lib/types";

vi.mock("next-intl", () => ({
  useTranslations: makeUseTranslations(),
}));

const setAccountExcluded = vi.fn();
vi.mock("@/lib/actions", () => ({
  setAccountExcluded: (...args: unknown[]) => setAccountExcluded(...args),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (...args: unknown[]) => toastError(...args) },
}));

import { AccountVisibilityList } from "./account-visibility-list";

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    internalId: "acc-1",
    label: "Compte courant",
    shortLabel: "CC",
    type: "current",
    iban: "FR76 •••• •••• •••• 4521",
    amount: 100,
    amountCurrency: "EUR",
    userRole: "holder",
    holderLabel: "Compte Démo",
    bankCode: "30002",
    agencyCode: "00550",
    productType: "CCHQ",
    accountCreationDate: "2020-01-01T00:00:00.000Z",
    bankLabel: "Banque Démo",
    status: "active",
    excluded: false,
    ...overrides,
  };
}

describe("AccountVisibilityList", () => {
  beforeEach(() => {
    setAccountExcluded.mockReset().mockResolvedValue(undefined);
    toastError.mockClear();
  });

  it("shows the empty-state message when there are no accounts", () => {
    render(<AccountVisibilityList accounts={[]} />);
    expect(screen.getByText("noAccounts")).toBeInTheDocument();
  });

  it("renders one row per account with the switch reflecting its excluded state", () => {
    const accounts = [makeAccount({ internalId: "acc-1", label: "Compte courant", excluded: false })];
    render(<AccountVisibilityList accounts={accounts} />);

    expect(screen.getByText("Compte courant")).toBeInTheDocument();
    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("optimistically checks the switch and calls setAccountExcluded(true) when toggling an included account off", async () => {
    // A promise we resolve manually so we can inspect the optimistic UI
    // while the (mocked) server action is still in flight, before
    // useOptimistic reverts to the base `accounts` prop once it settles.
    let resolveAction!: () => void;
    setAccountExcluded.mockReturnValue(new Promise<void>((resolve) => (resolveAction = resolve)));

    const user = userEvent.setup();
    const accounts = [makeAccount({ internalId: "acc-1", excluded: false })];
    render(<AccountVisibilityList accounts={accounts} />);

    await user.click(screen.getByRole("switch"));

    expect(setAccountExcluded).toHaveBeenCalledWith("acc-1", true);
    expect(screen.getByRole("switch")).toBeChecked();

    resolveAction();
  });

  it("optimistically unchecks the switch and calls setAccountExcluded(false) when toggling an excluded account back on", async () => {
    let resolveAction!: () => void;
    setAccountExcluded.mockReturnValue(new Promise<void>((resolve) => (resolveAction = resolve)));

    const user = userEvent.setup();
    const accounts = [makeAccount({ internalId: "acc-1", excluded: true })];
    render(<AccountVisibilityList accounts={accounts} />);

    expect(screen.getByRole("switch")).toBeChecked();
    await user.click(screen.getByRole("switch"));

    expect(setAccountExcluded).toHaveBeenCalledWith("acc-1", false);
    expect(screen.getByRole("switch")).not.toBeChecked();

    resolveAction();
  });

  it("shows an error toast when the action rejects", async () => {
    setAccountExcluded.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    const accounts = [makeAccount({ internalId: "acc-1", excluded: false })];
    render(<AccountVisibilityList accounts={accounts} />);

    await user.click(screen.getByRole("switch"));

    expect(toastError).toHaveBeenCalledWith("boom");
  });
});
