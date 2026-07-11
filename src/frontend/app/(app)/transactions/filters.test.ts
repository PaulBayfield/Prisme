import { describe, expect, it } from "vitest";

import { buildHref, STATUS_LABEL_KEYS } from "./filters";

describe("buildHref", () => {
  it("returns the bare path for the 'all' status (no query string)", () => {
    expect(buildHref("all")).toBe("/transactions");
  });

  it("adds a status query param for 'processed'", () => {
    expect(buildHref("processed")).toBe("/transactions?status=processed");
  });

  it("adds a status query param for 'pending'", () => {
    expect(buildHref("pending")).toBe("/transactions?status=pending");
  });
});

describe("STATUS_LABEL_KEYS", () => {
  it("has a label key entry for every status", () => {
    expect(STATUS_LABEL_KEYS).toEqual({
      all: "statusAll",
      processed: "statusProcessed",
      pending: "statusPending",
    });
  });
});
