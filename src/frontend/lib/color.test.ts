import { describe, expect, it } from "vitest";

import { getContrastTextColor } from "./color";

describe("getContrastTextColor", () => {
  it("returns dark text for a light background", () => {
    expect(getContrastTextColor("#ffffff")).toBe("#111827");
  });

  it("returns light text for a dark background", () => {
    expect(getContrastTextColor("#000000")).toBe("#ffffff");
  });

  it("works without a leading #", () => {
    expect(getContrastTextColor("ffffff")).toBe("#111827");
    expect(getContrastTextColor("000000")).toBe("#ffffff");
  });

  it("is case-insensitive on hex digits", () => {
    expect(getContrastTextColor("#FFFFFF")).toBe("#111827");
    expect(getContrastTextColor("#AbCdEf")).toBe(getContrastTextColor("#abcdef"));
  });

  it("falls back to white text for an invalid/malformed hex value", () => {
    expect(getContrastTextColor("not-a-color")).toBe("#ffffff");
    expect(getContrastTextColor("")).toBe("#ffffff");
    expect(getContrastTextColor("#fff")).toBe("#ffffff");
    expect(getContrastTextColor("#12345")).toBe("#ffffff");
  });

  it("is deterministic - the same input always yields the same output", () => {
    const first = getContrastTextColor("#3366ff");
    const second = getContrastTextColor("#3366ff");
    expect(first).toBe(second);
  });

  it("picks dark text right at the luminance threshold boundary", () => {
    // Pure mid-gray (#999999) has luminance ~0.599 (just under 0.6) -> light text.
    expect(getContrastTextColor("#999999")).toBe("#ffffff");
    // A slightly lighter gray pushes luminance just over 0.6 -> dark text.
    expect(getContrastTextColor("#a0a0a0")).toBe("#111827");
  });
});
