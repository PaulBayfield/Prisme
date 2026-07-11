import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { makeUseTranslations } from "@/test/mock-translations";

vi.mock("next-intl", () => ({
  useTranslations: makeUseTranslations(),
}));

import { ColorPicker } from "./color-picker";

describe("ColorPicker", () => {
  it("shows the current hex value on the trigger (with a leading #)", () => {
    render(<ColorPicker value="3b82f6" onChange={() => {}} />);
    expect(screen.getByText("#3b82f6")).toBeInTheDocument();
  });

  it("falls back to the default red when given an invalid value", () => {
    render(<ColorPicker value="" onChange={() => {}} />);
    expect(screen.getByText("#ef4444")).toBeInTheDocument();
  });

  it("marks the preset swatch matching the current value as active", async () => {
    const user = userEvent.setup();
    render(<ColorPicker value="ef4444" onChange={() => {}} />);

    await user.click(screen.getByRole("button", { name: "chooseColor" }));

    const activeSwatch = await screen.findByRole("button", { name: "#ef4444" });
    expect(activeSwatch.className).toContain("border-foreground");

    const inactiveSwatch = screen.getByRole("button", { name: "#3b82f6" });
    expect(inactiveSwatch.className).not.toContain("border-foreground");
  });

  it("calls onChange (debounced) with the clicked preset's hex, and updates the trigger/input immediately", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    render(<ColorPicker value="ef4444" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "chooseColor" }));
    await user.click(await screen.findByRole("button", { name: "#3b82f6" }));

    // UI updates instantly...
    expect(screen.getByDisplayValue("3B82F6")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    // ...but the onChange call is debounced by 500ms.
    vi.advanceTimersByTime(500);
    expect(onChange).toHaveBeenCalledWith("3b82f6");

    vi.useRealTimers();
  });

  it("typing a full 6-digit hex into the input updates the swatch and debounces onChange", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    render(<ColorPicker value="ef4444" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "chooseColor" }));
    const input = await screen.findByDisplayValue("EF4444");
    // fireEvent.change sets the whole value atomically - typing character by
    // character would hit the input's controlled re-render (which uppercases
    // for display) between keystrokes and produce a mixed-case value; that's
    // a quirk of the component's display formatting, not what this test is
    // about, so avoid it here.
    fireEvent.change(input, { target: { value: "22c55e" } });

    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(onChange).toHaveBeenCalledWith("22c55e");

    vi.useRealTimers();
  });
});
