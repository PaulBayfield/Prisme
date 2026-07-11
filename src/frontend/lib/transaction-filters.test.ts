import { beforeEach, describe, expect, it, vi } from "vitest";

// Same rationale as date-range.test.ts: stub "server-only" and "next/headers"
// so the cookie-parsing logic can run under Vitest.
vi.mock("server-only", () => ({}));

const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));

const { EMPTY_TRANSACTION_FILTERS, FILTERS_COOKIE_NAME, getTransactionFiltersFromCookies } =
  await import("./transaction-filters");

describe("getTransactionFiltersFromCookies", () => {
  beforeEach(() => {
    cookieStore.get.mockReset();
  });

  it("returns the empty filters when the cookie is absent", async () => {
    cookieStore.get.mockReturnValue(undefined);
    expect(await getTransactionFiltersFromCookies()).toEqual(EMPTY_TRANSACTION_FILTERS);
  });

  it("reads from the expected cookie name", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await getTransactionFiltersFromCookies();
    expect(cookieStore.get).toHaveBeenCalledWith(FILTERS_COOKIE_NAME);
  });

  it("falls back to empty filters when the cookie value isn't valid JSON", async () => {
    cookieStore.get.mockReturnValue({ value: "{not json" });
    expect(await getTransactionFiltersFromCookies()).toEqual(EMPTY_TRANSACTION_FILTERS);
  });

  it("parses a fully-populated filters payload", async () => {
    const payload = {
      categoryIds: [1, 2, 3],
      type: "expense",
      accountIds: ["acc-1", "acc-2"],
      amountMin: 10,
      amountMax: 500,
      search: "groceries",
    };
    cookieStore.get.mockReturnValue({ value: JSON.stringify(payload) });
    expect(await getTransactionFiltersFromCookies()).toEqual(payload);
  });

  it("accepts 'income' and 'all' as valid type values", async () => {
    cookieStore.get.mockReturnValue({ value: JSON.stringify({ type: "income" }) });
    expect((await getTransactionFiltersFromCookies()).type).toBe("income");

    cookieStore.get.mockReturnValue({ value: JSON.stringify({ type: "all" }) });
    expect((await getTransactionFiltersFromCookies()).type).toBe("all");
  });

  it("normalizes an invalid type value to 'all'", async () => {
    cookieStore.get.mockReturnValue({ value: JSON.stringify({ type: "bogus" }) });
    expect((await getTransactionFiltersFromCookies()).type).toBe("all");
  });

  it("filters out non-number entries from categoryIds", async () => {
    cookieStore.get.mockReturnValue({
      value: JSON.stringify({ categoryIds: [1, "2", null, 3] }),
    });
    expect((await getTransactionFiltersFromCookies()).categoryIds).toEqual([1, 3]);
  });

  it("defaults categoryIds to [] when not an array", async () => {
    cookieStore.get.mockReturnValue({ value: JSON.stringify({ categoryIds: "not-an-array" }) });
    expect((await getTransactionFiltersFromCookies()).categoryIds).toEqual([]);
  });

  it("filters out non-string entries from accountIds", async () => {
    cookieStore.get.mockReturnValue({
      value: JSON.stringify({ accountIds: ["a", 2, "b", null] }),
    });
    expect((await getTransactionFiltersFromCookies()).accountIds).toEqual(["a", "b"]);
  });

  it("defaults amountMin/amountMax to null when not numbers", async () => {
    cookieStore.get.mockReturnValue({
      value: JSON.stringify({ amountMin: "10", amountMax: undefined }),
    });
    const result = await getTransactionFiltersFromCookies();
    expect(result.amountMin).toBeNull();
    expect(result.amountMax).toBeNull();
  });

  it("defaults search to '' when not a string", async () => {
    cookieStore.get.mockReturnValue({ value: JSON.stringify({ search: 123 }) });
    expect((await getTransactionFiltersFromCookies()).search).toBe("");
  });

  it("ignores unset fields, falling back to their individual defaults", async () => {
    cookieStore.get.mockReturnValue({ value: JSON.stringify({ search: "coffee" }) });
    expect(await getTransactionFiltersFromCookies()).toEqual({
      ...EMPTY_TRANSACTION_FILTERS,
      search: "coffee",
    });
  });
});
