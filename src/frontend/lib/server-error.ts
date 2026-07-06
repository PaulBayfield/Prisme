import "server-only";

import { getTranslations } from "next-intl/server";

// Shared by lib/actions.real.ts and lib/demo/actions.ts - both throw plain
// Error objects whose .message ends up directly in a client-side toast, so
// unlike thrown-and-caught internal errors, these need to go through the
// current request's locale rather than being hardcoded.
export async function serverError(key: string): Promise<Error> {
  const t = await getTranslations("serverErrors");
  return new Error(t(key as Parameters<typeof t>[0]));
}
