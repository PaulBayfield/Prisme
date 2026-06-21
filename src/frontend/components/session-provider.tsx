"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextAuthSessionProvider>) {
  return <NextAuthSessionProvider {...props}>{children}</NextAuthSessionProvider>;
}
