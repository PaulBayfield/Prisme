import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeUseTranslations } from "@/test/mock-translations";

vi.mock("next-intl", () => ({
  useTranslations: makeUseTranslations(),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const deleteAsset = vi.fn();
vi.mock("@/lib/actions", () => ({
  deleteAsset: (...args: unknown[]) => deleteAsset(...args),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { DeleteAssetButton } from "./delete-asset-button";

describe("DeleteAssetButton", () => {
  beforeEach(() => {
    push.mockClear();
    deleteAsset.mockReset();
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it("does not call deleteAsset until the alert dialog is confirmed", async () => {
    const user = userEvent.setup();
    render(<DeleteAssetButton assetId={42} name="Maison" />);

    await user.click(screen.getByRole("button", { name: "deleteButton" }));
    expect(await screen.findByText("deleteTitle:{\"name\":\"Maison\"}")).toBeInTheDocument();
    expect(deleteAsset).not.toHaveBeenCalled();
  });

  it("does nothing when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    render(<DeleteAssetButton assetId={42} name="Maison" />);

    await user.click(screen.getByRole("button", { name: "deleteButton" }));
    await user.click(await screen.findByRole("button", { name: "cancel" }));

    expect(deleteAsset).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText("deleteTitle:{\"name\":\"Maison\"}")).not.toBeInTheDocument();
    });
  });

  it("calls deleteAsset with the asset id, shows a success toast, and navigates on confirm", async () => {
    deleteAsset.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<DeleteAssetButton assetId={42} name="Maison" />);

    await user.click(screen.getByRole("button", { name: "deleteButton" }));
    await user.click(await screen.findByRole("button", { name: "delete" }));

    await waitFor(() => expect(deleteAsset).toHaveBeenCalledWith(42));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("deleteSuccess"));
    expect(push).toHaveBeenCalledWith("/patrimoine");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("shows an error toast with the thrown message and does not navigate when deleteAsset rejects", async () => {
    deleteAsset.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    render(<DeleteAssetButton assetId={42} name="Maison" />);

    await user.click(screen.getByRole("button", { name: "deleteButton" }));
    await user.click(await screen.findByRole("button", { name: "delete" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("boom"));
    expect(push).not.toHaveBeenCalled();
  });

  it("falls back to the translated error message when the rejection isn't an Error", async () => {
    deleteAsset.mockRejectedValueOnce("not an Error instance");
    const user = userEvent.setup();
    render(<DeleteAssetButton assetId={42} name="Maison" />);

    await user.click(screen.getByRole("button", { name: "deleteButton" }));
    await user.click(await screen.findByRole("button", { name: "delete" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("deleteError"));
    expect(push).not.toHaveBeenCalled();
  });
});
