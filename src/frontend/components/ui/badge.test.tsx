import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";

describe("Badge", () => {
  it("renders its children as visible text", () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("renders as a span by default", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default").tagName).toBe("SPAN");
  });

  it("applies the default variant's classes", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default")).toHaveClass("bg-primary", "text-primary-foreground");
  });

  it("applies the destructive variant's classes", () => {
    render(<Badge variant="destructive">Danger</Badge>);
    expect(screen.getByText("Danger")).toHaveClass("bg-destructive/10", "text-destructive");
  });

  it("merges a custom className with the variant classes", () => {
    render(<Badge className="my-custom-class">Custom</Badge>);
    expect(screen.getByText("Custom")).toHaveClass("my-custom-class", "bg-primary");
  });
});
