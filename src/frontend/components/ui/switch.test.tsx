import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Switch } from "./switch";

describe("Switch", () => {
  it("is unchecked by default", () => {
    render(<Switch aria-label="Notifications" />);
    expect(screen.getByRole("switch", { name: "Notifications" })).not.toBeChecked();
  });

  it("toggles from unchecked to checked on click", async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Notifications" />);

    const toggle = screen.getByRole("switch", { name: "Notifications" });
    await user.click(toggle);
    expect(toggle).toBeChecked();
  });

  it("supports being a controlled component via checked/onCheckedChange", async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch aria-label="Notifications" checked={false} onCheckedChange={onCheckedChange} />);

    await user.click(screen.getByRole("switch", { name: "Notifications" }));
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  });

  it("respects the defaultChecked prop", () => {
    render(<Switch aria-label="Notifications" defaultChecked />);
    expect(screen.getByRole("switch", { name: "Notifications" })).toBeChecked();
  });

  it("does not toggle when disabled", async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Notifications" disabled />);

    const toggle = screen.getByRole("switch", { name: "Notifications" });
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(toggle.className).toContain("data-disabled:cursor-not-allowed");
  });

  it("applies the sm size's data attribute", () => {
    render(<Switch aria-label="Notifications" size="sm" />);
    expect(screen.getByRole("switch", { name: "Notifications" })).toHaveAttribute("data-size", "sm");
  });
});
