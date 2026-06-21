"use client";

import { useState } from "react";

import { LclConnectionPanel } from "@/components/lcl-connection-panel";
import { Button } from "@/components/ui/button";

export function CredentialsStep({
  initialHasCredentials,
  onNext,
}: {
  initialHasCredentials: boolean;
  onNext: () => void;
}) {
  const [connected, setConnected] = useState(initialHasCredentials);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Connexion bancaire</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Connectez votre compte LCL via l&apos;extension LCL Creds Grabber pour que Prisme synchronise vos
          comptes et transactions automatiquement. Cette étape est obligatoire.
        </p>
      </div>

      <LclConnectionPanel initialHasCredentials={initialHasCredentials} onConnected={() => setConnected(true)} />

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={onNext} disabled={!connected}>
          Continuer
        </Button>
      </div>
    </div>
  );
}
