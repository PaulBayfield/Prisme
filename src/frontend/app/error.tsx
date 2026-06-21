"use client";

import { useEffect } from "react";
import { OctagonXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Error({
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
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-24 text-center">
      <OctagonXIcon className="size-8 text-destructive" />
      <p className="text-sm font-medium">Une erreur est survenue</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Le chargement de cette page a échoué. Réessayez, ou revenez plus tard si le problème persiste.
      </p>
      <Button size="sm" className="mt-2" onClick={reset}>
        Réessayer
      </Button>
    </div>
  );
}
