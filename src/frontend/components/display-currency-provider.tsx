"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setDisplayCurrencyCookie } from "@/lib/actions";

interface DisplayCurrencyContextValue {
  code: string;
  rate: number;
  isPending: boolean;
  setDisplayCurrency: (code: string) => void;
}

const DisplayCurrencyContext = React.createContext<DisplayCurrencyContextValue | null>(null);

// Seeded from the server (app/(app)/layout.tsx reads the cookie via
// lib/display-currency.ts) so client-rendered charts can convert amounts
// the same way server components do, without duplicating the cookie/rate
// lookup on the client. Switching currency writes the cookie then calls
// router.refresh() so server components re-render with the new rate, which
// flows back down as fresh code/rate props here.
export function DisplayCurrencyProvider({
  code,
  rate,
  children,
}: {
  code: string;
  rate: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const setDisplayCurrency = React.useCallback(
    (next: string) => {
      startTransition(async () => {
        try {
          await setDisplayCurrencyCookie(next);
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Erreur lors du changement de devise");
        }
      });
    },
    [router],
  );

  return (
    <DisplayCurrencyContext.Provider value={{ code, rate, isPending, setDisplayCurrency }}>
      {children}
    </DisplayCurrencyContext.Provider>
  );
}

export function useDisplayCurrency(): DisplayCurrencyContextValue {
  const context = React.useContext(DisplayCurrencyContext);
  if (!context) {
    throw new Error("useDisplayCurrency must be used within a DisplayCurrencyProvider");
  }
  return context;
}
