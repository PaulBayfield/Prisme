import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeUseTranslations } from "@/test/mock-translations";

vi.mock("next-intl", () => ({
  useTranslations: makeUseTranslations(),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/transactions",
  useSearchParams: () => new URLSearchParams(),
}));

import { DetailedModeToggle } from "./detailed-mode-toggle";

describe("DetailedModeToggle", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("renders the outline variant and adds ?detailed=true when currently off", async () => {
    const user = userEvent.setup();
    render(<DetailedModeToggle detailed={false} />);

    const button = screen.getByRole("button", { name: "toggle" });
    expect(button.className).toContain("border-border");

    await user.click(button);
    expect(push).toHaveBeenCalledWith("/transactions?detailed=true");
  });

  it("renders the default (filled) variant and strips ?detailed when currently on", async () => {
    const user = userEvent.setup();
    render(<DetailedModeToggle detailed={true} />);

    const button = screen.getByRole("button", { name: "toggle" });
    expect(button.className).toContain("bg-primary");

    await user.click(button);
    expect(push).toHaveBeenCalledWith("/transactions");
  });
});
