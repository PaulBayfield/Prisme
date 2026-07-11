import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("applies the default variant and default size classes", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("h-8");
  });

  it("applies the destructive variant's classes", () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button", { name: "Delete" }).className).toContain("bg-destructive/10");
  });

  it("applies the outline variant's classes", () => {
    render(<Button variant="outline">Cancel</Button>);
    expect(screen.getByRole("button", { name: "Cancel" }).className).toContain("bg-background");
  });

  it("applies the icon size class", () => {
    render(<Button size="icon" aria-label="Options" />);
    expect(screen.getByRole("button", { name: "Options" }).className).toContain("size-8");
  });

  it("applies the lg size class", () => {
    render(<Button size="lg">Big</Button>);
    expect(screen.getByRole("button", { name: "Big" }).className).toContain("h-9");
  });

  it("fires onClick when clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Go</Button>);

    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick and applies disabled styling when disabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Go" });
    expect(button).toBeDisabled();
    expect(button.className).toContain("disabled:opacity-50");

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
