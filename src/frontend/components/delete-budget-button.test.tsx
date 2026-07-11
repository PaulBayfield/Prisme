import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeUseTranslations } from "@/test/mock-translations";

vi.mock("next-intl", () => ({
  useTranslations: makeUseTranslations(),
}));

const deleteBudget = vi.fn();
vi.mock("@/lib/actions", () => ({
  deleteBudget: (...args: unknown[]) => deleteBudget(...args),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { DeleteBudgetButton } from "./delete-budget-button";

describe("DeleteBudgetButton", () => {
  beforeEach(() => {
    deleteBudget.mockReset();
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  // DeleteBudgetButton has no useRouter/router.push - unlike DeleteAssetButton,
  // deleting a budget just revalidates the current list in place.
  it("calls deleteBudget with the budget id and shows a success toast on confirm", async () => {
    deleteBudget.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<DeleteBudgetButton budgetId={7} categoryName="Courses" />);

    await user.click(screen.getByRole("button", { name: "deleteButton" }));
    await user.click(await screen.findByRole("button", { name: "delete" }));

    await waitFor(() => expect(deleteBudget).toHaveBeenCalledWith(7));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("deleteSuccess"));
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows an error toast with the thrown message when deleteBudget rejects", async () => {
    deleteBudget.mockRejectedValueOnce(new Error("network down"));
    const user = userEvent.setup();
    render(<DeleteBudgetButton budgetId={7} categoryName="Courses" />);

    await user.click(screen.getByRole("button", { name: "deleteButton" }));
    await user.click(await screen.findByRole("button", { name: "delete" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("network down"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
