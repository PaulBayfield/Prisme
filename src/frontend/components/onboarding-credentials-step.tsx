"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { LclConnectionPanel } from "@/components/lcl-connection-panel";
import { Button } from "@/components/ui/button";

export function CredentialsStep({
  initialHasCredentials,
  onNext,
}: {
  initialHasCredentials: boolean;
  onNext: () => void;
}) {
  const t = useTranslations("onboarding");
  const [connected, setConnected] = useState(initialHasCredentials);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{t("steps.bankConnection")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("credentialsStep.description")}</p>
      </div>

      <LclConnectionPanel initialHasCredentials={initialHasCredentials} onConnected={() => setConnected(true)} />

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={onNext} disabled={!connected}>
          {t("continue")}
        </Button>
      </div>
    </div>
  );
}
