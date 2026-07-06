"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { SessionProvider as NextAuthSessionProvider, useSession } from "next-auth/react";
import { toast } from "sonner";

// Polls the session so an expiry that happens while the tab is idle (no
// navigation, no window focus change) is still detected instead of waiting
// for the user to hit a page the middleware guards.
const SESSION_POLL_INTERVAL_SECONDS = 60;

function SessionExpiryRedirect() {
  const { status } = useSession();
  const router = useRouter();
  const t = useTranslations("session");

  useEffect(() => {
    if (status !== "unauthenticated") {
      return;
    }
    if (window.location.pathname === "/login") {
      return;
    }
    toast.info(t("expiredMessage"));
    router.replace("/login");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t's identity isn't relevant to when this redirect should fire
  }, [status, router]);

  return null;
}

export function SessionProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextAuthSessionProvider>) {
  return (
    <NextAuthSessionProvider refetchInterval={SESSION_POLL_INTERVAL_SECONDS} refetchOnWindowFocus {...props}>
      <SessionExpiryRedirect />
      {children}
    </NextAuthSessionProvider>
  );
}
