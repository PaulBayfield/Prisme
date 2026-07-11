import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeUseTranslations } from "@/test/mock-translations";

vi.mock("next-intl", () => ({
  useTranslations: makeUseTranslations(),
}));

import { BlurProvider } from "./blur-provider";
import { BlurToggle } from "./blur-toggle";

describe("BlurToggle", () => {
  // BlurProvider persists to localStorage and toggles an attribute on
  // <html>, both of which live outside the RTL-rendered tree and so survive
  // across tests within this file (jsdom's document/localStorage aren't
  // reset by @testing-library/react's cleanup) - reset them explicitly so
  // each test starts from the same "unblurred" state.
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-blur-amounts");
  });

  it("starts unblurred: shows the Eye icon and no data-blur-amounts attribute", () => {
    render(
      <BlurProvider>
        <BlurToggle />
      </BlurProvider>,
    );
    expect(document.documentElement.hasAttribute("data-blur-amounts")).toBe(false);
    expect(document.querySelector("svg.lucide-eye")).toBeInTheDocument();
    expect(document.querySelector("svg.lucide-eye-off")).not.toBeInTheDocument();
  });

  it("toggles to blurred on click: swaps to EyeOff and sets data-blur-amounts on <html>", async () => {
    const user = userEvent.setup();
    render(
      <BlurProvider>
        <BlurToggle />
      </BlurProvider>,
    );

    await user.click(screen.getByRole("button"));

    expect(document.documentElement.hasAttribute("data-blur-amounts")).toBe(true);
    expect(document.querySelector("svg.lucide-eye-off")).toBeInTheDocument();
    expect(document.querySelector("svg.lucide-eye")).not.toBeInTheDocument();
  });

  it("toggles back to unblurred on a second click", async () => {
    const user = userEvent.setup();
    render(
      <BlurProvider>
        <BlurToggle />
      </BlurProvider>,
    );

    const button = screen.getByRole("button");
    await user.click(button);
    await user.click(button);

    expect(document.documentElement.hasAttribute("data-blur-amounts")).toBe(false);
    expect(document.querySelector("svg.lucide-eye")).toBeInTheDocument();
  });

  it("uses the translated aria-label", () => {
    render(
      <BlurProvider>
        <BlurToggle />
      </BlurProvider>,
    );
    expect(screen.getByRole("button", { name: "privacy.hideAmountsLabel" })).toBeInTheDocument();
  });
});
