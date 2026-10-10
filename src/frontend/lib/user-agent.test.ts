import { describe, expect, it } from "vitest";

import { parseUserAgent } from "./user-agent";

describe("parseUserAgent", () => {
  it("falls back to an unknown desktop when there is no user agent", () => {
    expect(parseUserAgent(null)).toEqual({ browser: null, os: null, deviceType: "desktop" });
  });

  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      { browser: "Chrome", os: "Windows", deviceType: "desktop" },
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      { browser: "Edge", os: "Windows", deviceType: "desktop" },
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
      { browser: "Safari", os: "macOS", deviceType: "desktop" },
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0",
      { browser: "Firefox", os: "Linux", deviceType: "desktop" },
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      { browser: "Safari", os: "iOS", deviceType: "mobile" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
      { browser: "Chrome", os: "Android", deviceType: "mobile" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Safari/537.36",
      { browser: "Samsung Internet", os: "Android", deviceType: "tablet" },
    ],
    [
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1",
      { browser: "Chrome", os: "iOS", deviceType: "tablet" },
    ],
  ])("parses %s", (userAgent, expected) => {
    expect(parseUserAgent(userAgent)).toEqual(expected);
  });
});
