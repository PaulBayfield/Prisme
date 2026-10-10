export const SESSION_DURATION_COOKIE = "prisme-session-duration";

// How long a session survives without any activity (page load or server
// action) before it has to sign in again - chosen per device, so a phone
// can stay signed in for weeks while a shared desktop drops after minutes.
// `key` indexes account.security.durations in messages/*.json.
export const SESSION_DURATIONS = [
  { seconds: 15 * 60, key: "minutes15" },
  { seconds: 60 * 60, key: "hour1" },
  { seconds: 7 * 24 * 60 * 60, key: "days7" },
  { seconds: 30 * 24 * 60 * 60, key: "days30" },
] as const;

export const DEFAULT_SESSION_DURATION: number = SESSION_DURATIONS[0].seconds;
export const MAX_SESSION_DURATION: number = SESSION_DURATIONS[SESSION_DURATIONS.length - 1].seconds;

export function isSessionDuration(seconds: number): boolean {
  return SESSION_DURATIONS.some((duration) => duration.seconds === seconds);
}

// The cookie is client-writable, so anything that isn't one of the offered
// durations falls back to the shortest one rather than being trusted.
export function parseSessionDuration(value: string | null | undefined): number {
  const seconds = Number(value);
  return isSessionDuration(seconds) ? seconds : DEFAULT_SESSION_DURATION;
}
