import { describe, expect, it } from "vitest";

import { DEFAULT_SESSION_DURATION, MAX_SESSION_DURATION, parseSessionDuration } from "./session-duration";

describe("parseSessionDuration", () => {
  it("accepts an offered duration", () => {
    expect(parseSessionDuration(String(MAX_SESSION_DURATION))).toBe(MAX_SESSION_DURATION);
  });

  it.each([undefined, null, "", "abc", "0", "-900", "901", "99999999"])(
    "falls back to the shortest duration for %j",
    (value) => {
      expect(parseSessionDuration(value)).toBe(DEFAULT_SESSION_DURATION);
    },
  );
});
