/**
 * Shared factory for mocking `next-intl` (client) and `next-intl/server`
 * (server) translation hooks in tests.
 *
 * Components call `useTranslations("namespace")` / `await getTranslations("namespace")`
 * to get a translator function `t`, then call `t("key")` or `t("key", { param })`.
 * Real French copy isn't useful in tests (it changes, and it's hard to assert
 * on) - instead this returns a translator that echoes back the key itself, or
 * `` `${key}:${JSON.stringify(params)}` `` when interpolation params are
 * passed, so tests can assert on translation keys deterministically.
 *
 * Usage (client components):
 *
 *   vi.mock("next-intl", () => ({ useTranslations: makeUseTranslations() }));
 *
 * Usage (async server components):
 *
 *   vi.mock("next-intl/server", () => ({ getTranslations: makeGetTranslations() }));
 */

export function translate(key: string, params?: Record<string, unknown>): string {
  return params ? `${key}:${JSON.stringify(params)}` : key;
}

/** For `vi.mock("next-intl", () => ({ useTranslations: makeUseTranslations() }))`. */
export function makeUseTranslations() {
  return () => translate;
}

/** For `vi.mock("next-intl/server", () => ({ getTranslations: makeGetTranslations() }))`. */
export function makeGetTranslations() {
  return async () => translate;
}
