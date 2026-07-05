"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (status !== "unauthenticated") {
      return;
    }
    if (window.location.pathname === "/login") {
      return;
    }
    toast.info("Votre session a expiré, veuillez vous reconnecter.");
    router.replace("/login");
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
