import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// date-range.ts imports "server-only" (which throws when actually loaded
// outside a Server Component build) and "next/headers" (which requires a
// live Next.js request context) - stub both so the module's pure logic can
// be exercised directly under Vitest.
vi.mock("server-only", () => ({}));

const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));

const {
  ALL_TIME_SENTINEL,
  RANGE_COOKIE_NAME,
  parseDateRangeParams,
  getDateRangeCookieValue,
  getDateRangeFromCookies,
  rangeIncludesToday,
} = await import("./date-range");

describe("parseDateRangeParams", () => {
  it("returns null/null when both from and to are missing", () => {
    expect(parseDateRangeParams({})).toEqual({ from: null, to: null });
  });

  it("returns null/null when only one of from/to is provided", () => {
    expect(parseDateRangeParams({ from: "2026-01-01" })).toEqual({ from: null, to: null });
    expect(parseDateRangeParams({ to: "2026-01-31" })).toEqual({ from: null, to: null });
  });

  it("returns null/null when a date is malformed", () => {
    expect(parseDateRangeParams({ from: "not-a-date", to: "2026-01-31" })).toEqual({
      from: null,
      to: null,
    });
  });

  it("parses an inclusive from/to into an exclusive-`to` range (to + 1 day)", () => {
    const result = parseDateRangeParams({ from: "2026-01-01", to: "2026-01-31" });
    expect(result.from).toEqual(new Date("2026-01-01T00:00:00"));
    expect(result.to).toEqual(new Date("2026-02-01T00:00:00"));
  });

  it("rolls over correctly at a month/year boundary", () => {
    const result = parseDateRangeParams({ from: "2025-12-01", to: "2025-12-31" });
    expect(result.to).toEqual(new Date("2026-01-01T00:00:00"));
  });

  it("handles a single-day range (from === to)", () => {
    const result = parseDateRangeParams({ from: "2026-03-15", to: "2026-03-15" });
    expect(result.from).toEqual(new Date("2026-03-15T00:00:00"));
    expect(result.to).toEqual(new Date("2026-03-16T00:00:00"));
  });
});

describe("rangeIncludesToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is true when to is null (the 'Tout' / all-time case)", () => {
    expect(rangeIncludesToday({ from: null, to: null })).toBe(true);
  });

  it("is true when to is in the future", () => {
    expect(rangeIncludesToday({ from: null, to: new Date("2026-07-12T00:00:00") })).toBe(true);
  });

  it("is false when to is strictly in the past", () => {
    expect(rangeIncludesToday({ from: null, to: new Date("2026-07-01T00:00:00") })).toBe(false);
  });
});

describe("getDateRangeCookieValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T12:00:00"));
    cookieStore.get.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to first-of-month..today when the cookie is absent", async () => {
    cookieStore.get.mockReturnValue(undefined);
    expect(await getDateRangeCookieValue()).toEqual({ from: "2026-07-01", to: "2026-07-11" });
  });

  it("returns null for the explicit all-time sentinel", async () => {
    cookieStore.get.mockReturnValue({ value: ALL_TIME_SENTINEL });
    expect(await getDateRangeCookieValue()).toBeNull();
  });

  it("parses an explicit from|to cookie value", async () => {
    cookieStore.get.mockReturnValue({ value: "2026-02-01|2026-02-28" });
    expect(await getDateRangeCookieValue()).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("falls back to the current-month default for a malformed cookie value", async () => {
    cookieStore.get.mockReturnValue({ value: "garbage" });
    expect(await getDateRangeCookieValue()).toEqual({ from: "2026-07-01", to: "2026-07-11" });
  });

  it("reads from the expected cookie name", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await getDateRangeCookieValue();
    expect(cookieStore.get).toHaveBeenCalledWith(RANGE_COOKIE_NAME);
  });
});

describe("getDateRangeFromCookies", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T12:00:00"));
    cookieStore.get.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("combines the cookie lookup with param parsing end-to-end", async () => {
    cookieStore.get.mockReturnValue({ value: "2026-02-01|2026-02-28" });
    const result = await getDateRangeFromCookies();
    expect(result.from).toEqual(new Date("2026-02-01T00:00:00"));
    expect(result.to).toEqual(new Date("2026-03-01T00:00:00"));
  });

  it("returns null/null for the all-time sentinel", async () => {
    cookieStore.get.mockReturnValue({ value: ALL_TIME_SENTINEL });
    const result = await getDateRangeFromCookies();
    expect(result).toEqual({ from: null, to: null });
  });
});
