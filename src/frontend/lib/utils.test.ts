import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("joins plain string arguments with a space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("drops falsy values (undefined, null, false, empty string)", () => {
    expect(cn("a", undefined, null, false, "", "b")).toBe("a b");
  });

  it("applies conditional (object-form) classes", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });

  it("merges conflicting tailwind classes, keeping the last one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("merges conflicting tailwind classes across nested arrays", () => {
    expect(cn("p-2", ["text-sm", "p-4"])).toBe("text-sm p-4");
  });

  it("keeps non-conflicting classes from both sides", () => {
    expect(cn("text-sm font-bold", "text-red-500")).toBe("text-sm font-bold text-red-500");
  });

  it("returns an empty string when given nothing meaningful", () => {
    expect(cn()).toBe("");
    expect(cn(undefined, null, false)).toBe("");
  });
});
