import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getDisplayCurrency = vi.fn();
vi.mock("@/lib/display-currency", () => ({
  getDisplayCurrency: () => getDisplayCurrency(),
}));

import { BalanceTrend } from "./balance-trend";

describe("BalanceTrend", () => {
  beforeEach(() => {
    getDisplayCurrency.mockResolvedValue({ code: "EUR", rate: 1 });
  });

  it("shows the change as an amount by default", async () => {
    render(await BalanceTrend({ first: 1000, last: 1125 }));

    expect(screen.getByText(/\+125,00/)).toBeInTheDocument();
  });

  it("shows the change as a percentage in percent mode, with the amount hidden until hover", async () => {
    render(await BalanceTrend({ first: 1000, last: 1125, display: "percent" }));

    // The swap itself is pure CSS (group-hover), so assert on the classes.
    expect(screen.getByText(/\+12,5\s?%/)).toHaveClass("group-hover/trend:opacity-0");
    expect(screen.getByText(/\+125,00/)).toHaveClass("opacity-0", "group-hover/trend:opacity-100");
  });

  it("shows a negative percentage for a decrease", async () => {
    render(await BalanceTrend({ first: 200, last: 150, display: "percent" }));

    expect(screen.getByText(/-25\s?%/)).toBeInTheDocument();
  });

  it("falls back to the amount in percent mode when the starting balance is 0", async () => {
    render(await BalanceTrend({ first: 0, last: 50, display: "percent" }));

    expect(screen.getByText(/\+50,00/)).toBeInTheDocument();
  });
});
