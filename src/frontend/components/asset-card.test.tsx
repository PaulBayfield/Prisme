import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeGetTranslations } from "@/test/mock-translations";
import type { Asset } from "@/lib/types";

vi.mock("next-intl/server", () => ({
  getTranslations: makeGetTranslations(),
}));

const getDisplayCurrency = vi.fn();
vi.mock("@/lib/display-currency", () => ({
  getDisplayCurrency: () => getDisplayCurrency(),
}));

import { AssetCard } from "./asset-card";

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 1,
    name: "Maison",
    type: "real_estate",
    notes: null,
    value: 250000,
    valueCurrency: "EUR",
    valuedAt: "2026-01-01",
    ...overrides,
  };
}

describe("AssetCard", () => {
  it("shows the translated label for the asset's type", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "EUR", rate: 1 });
    render(await AssetCard({ asset: makeAsset({ type: "vehicle" }) }));

    expect(screen.getByText("vehicle")).toBeInTheDocument();
  });

  it("falls back to the 'other' type definition for an unknown type value", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "EUR", rate: 1 });
    render(await AssetCard({ asset: makeAsset({ type: "not-a-real-type" }) }));

    expect(screen.getByText("other")).toBeInTheDocument();
    expect(document.querySelector("svg.lucide-package")).toBeInTheDocument();
  });

  it("formats the value using the resolved display currency and rate", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "USD", rate: 1.5 });
    render(await AssetCard({ asset: makeAsset({ value: 100 }) }));

    expect(screen.getByText(/150[,.]00/)).toBeInTheDocument();
  });

  it("links to the asset's detail page by id", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "EUR", rate: 1 });
    render(await AssetCard({ asset: makeAsset({ id: 7 }) }));

    expect(screen.getByRole("link")).toHaveAttribute("href", "/patrimoine/7");
  });

  it("renders the asset name", async () => {
    getDisplayCurrency.mockResolvedValue({ code: "EUR", rate: 1 });
    render(await AssetCard({ asset: makeAsset({ name: "Voiture" }) }));

    expect(screen.getByText("Voiture")).toBeInTheDocument();
  });
});
