import "server-only";

import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const LOCALE_COOKIE = "prisme-locale";
export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

// No URL-based locale routing (no [locale] segment, no next-intl middleware) -
// this app is entirely behind auth with no public/SEO-relevant pages, and
// composing next-intl's routing middleware with next-auth's withAuth (see
// proxy.tsx) is a well-known source of redirect/locale-loss bugs for little
// benefit here. The locale is just a cookie, same pattern as
// lib/display-currency.ts.
export async function getLocaleCookie(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return value === "en" ? "en" : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await getLocaleCookie();
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
