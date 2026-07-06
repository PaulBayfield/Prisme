"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createCredentialExchangeRequest, submitCredentialPayload } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";

// Shared between the onboarding wizard's credentials step and Settings ->
// Compte, so a user can redo this exact copy-paste flow later if their LCL
// session/credentials expire, not just on first connection. isDemoMode is
// only ever true from Settings -> Compte: onboarding always redirects a
// (pre-onboarded) demo user away before this panel would render there.
export function LclConnectionPanel({
  initialHasCredentials,
  onConnected,
  isDemoMode,
}: {
  initialHasCredentials: boolean;
  onConnected?: () => void;
  isDemoMode?: boolean;
}) {
  const t = useTranslations("lclConnection");
  const [connected, setConnected] = useState(initialHasCredentials);
  const [passphrase, setPassphrase] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [payload, setPayload] = useState("");
  const [isGenerating, startGenerating] = useTransition();
  const [isSubmitting, startSubmitting] = useTransition();

  function generatePassphrase() {
    startGenerating(async () => {
      try {
        const result = await createCredentialExchangeRequest();
        setPassphrase(result.passphrase);
        setExpiresAt(result.expiresAt);
        setPayload("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("generateError"));
      }
    });
  }

  function copyPassphrase() {
    if (!passphrase) return;
    navigator.clipboard.writeText(passphrase);
    toast.success(t("passphraseCopied"));
  }

  function submitPayload() {
    if (!payload.trim()) {
      toast.error(t("pastePayloadFirst"));
      return;
    }
    startSubmitting(async () => {
      try {
        await submitCredentialPayload(payload);
        setConnected(true);
        setPassphrase(null);
        setExpiresAt(null);
        setPayload("");
        toast.success(t("accountConnected"));
        onConnected?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("validateError"));
      }
    });
  }

  if (isDemoMode) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-green-600/30 bg-green-600/10 p-4 text-sm">
          <Check className="size-4 shrink-0 text-green-600 dark:text-green-400" />
          <span>{t("connectedDemo")}</span>
        </div>
        <Tooltip>
          <TooltipTrigger render={<Button type="button" variant="outline" disabled />}>
            <KeyRound className="size-4" />
            {t("updateCredentials")}
          </TooltipTrigger>
          <TooltipContent>{t("unavailableInDemo")}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  if (!passphrase) {
    return (
      <div className="space-y-3">
        {connected ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-600/30 bg-green-600/10 p-4 text-sm">
            <Check className="size-4 shrink-0 text-green-600 dark:text-green-400" />
            <span>{t("connected")}</span>
          </div>
        ) : null}
        <Button type="button" variant="outline" onClick={generatePassphrase} disabled={isGenerating}>
          <KeyRound className="size-4" />
          {connected ? t("updateCredentials") : t("connectAccount")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
        <li>{t("step1")}</li>
        <li>{t("step2")}</li>
        <li>{t("step3")}</li>
        <li>{t("step4")}</li>
      </ol>

      <div className="space-y-1.5">
        <Label>{t("passphrase")}</Label>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border bg-muted px-3 py-2 text-sm">{passphrase}</code>
          <Button type="button" variant="outline" size="icon" onClick={copyPassphrase}>
            <Copy className="size-4" />
            <span className="sr-only">{t("copy")}</span>
          </Button>
        </div>
        {expiresAt ? (
          <p className="text-xs text-muted-foreground">{t("validUntil", { date: formatDateTime(expiresAt) })}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="extension-payload">{t("extensionPayloadLabel")}</Label>
        <Textarea
          id="extension-payload"
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          rows={4}
          placeholder={t("payloadPlaceholder")}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={generatePassphrase} disabled={isGenerating}>
            {t("newPassphrase")}
          </Button>
          <Button type="button" onClick={submitPayload} disabled={isSubmitting}>
            {t("validate")}
          </Button>
        </div>
      </div>
    </div>
  );
}
