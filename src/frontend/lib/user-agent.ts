export type DeviceType = "mobile" | "tablet" | "desktop";

export interface ParsedUserAgent {
  browser: string | null;
  os: string | null;
  deviceType: DeviceType;
}

// Order matters: Edge/Opera/Samsung all also advertise "Chrome", and Chrome
// also advertises "Safari", so the more specific tokens have to win.
const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const OPERATING_SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

// Only good enough to label a row in the sessions list ("Chrome · Android")
// so the user can tell their devices apart - not a general-purpose parser.
export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  if (!userAgent) {
    return { browser: null, os: null, deviceType: "desktop" };
  }

  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;
  const os = OPERATING_SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1] ?? null;

  let deviceType: DeviceType = "desktop";
  if (/iPad|Tablet/.test(userAgent) || (/Android/.test(userAgent) && !/Mobile/.test(userAgent))) {
    deviceType = "tablet";
  } else if (/Mobi|iPhone|iPod|Android/.test(userAgent)) {
    deviceType = "mobile";
  }

  return { browser, os, deviceType };
}
