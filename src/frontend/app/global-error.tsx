"use client";

import { useEffect } from "react";
import { OctagonXIcon } from "lucide-react";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center antialiased">
        <div className="flex flex-col items-center gap-2 text-center">
          <OctagonXIcon className="size-8 text-destructive" />
          <p className="text-sm font-medium">Prisme n&apos;a pas pu démarrer</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Le chargement de l&apos;application a échoué. Réessayez, ou revenez plus tard si le problème persiste.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
