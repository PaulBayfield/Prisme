"use client";

import { useState, useTransition } from "react";
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
        toast.error(error instanceof Error ? error.message : "Erreur lors de la génération");
      }
    });
  }

  function copyPassphrase() {
    if (!passphrase) return;
    navigator.clipboard.writeText(passphrase);
    toast.success("Phrase secrète copiée");
  }

  function submitPayload() {
    if (!payload.trim()) {
      toast.error("Collez d'abord les informations copiées depuis l'extension");
      return;
    }
    startSubmitting(async () => {
      try {
        await submitCredentialPayload(payload);
        setConnected(true);
        setPassphrase(null);
        setExpiresAt(null);
        setPayload("");
        toast.success("Compte LCL connecté");
        onConnected?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors de la validation");
      }
    });
  }

  if (isDemoMode) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-green-600/30 bg-green-600/10 p-4 text-sm">
          <Check className="size-4 shrink-0 text-green-600 dark:text-green-400" />
          <span>Compte LCL connecté (données de démonstration).</span>
        </div>
        <Tooltip>
          <TooltipTrigger render={<Button type="button" variant="outline" disabled />}>
            <KeyRound className="size-4" />
            Mettre à jour les identifiants
          </TooltipTrigger>
          <TooltipContent>Indisponible en mode démo</TooltipContent>
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
            <span>Compte LCL connecté.</span>
          </div>
        ) : null}
        <Button type="button" variant="outline" onClick={generatePassphrase} disabled={isGenerating}>
          <KeyRound className="size-4" />
          {connected ? "Mettre à jour les identifiants" : "Connecter mon compte LCL"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
        <li>Connectez-vous sur monespace.lcl.fr avec l&apos;extension installée.</li>
        <li>Copiez la phrase secrète ci-dessous.</li>
        <li>
          Dans le popup de l&apos;extension, collez-la dans le champ « Phrase secrète », puis cliquez sur
          « Copier les informations ».
        </li>
        <li>Collez le résultat copié par l&apos;extension dans le champ ci-dessous.</li>
      </ol>

      <div className="space-y-1.5">
        <Label>Phrase secrète</Label>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md border bg-muted px-3 py-2 text-sm">{passphrase}</code>
          <Button type="button" variant="outline" size="icon" onClick={copyPassphrase}>
            <Copy className="size-4" />
            <span className="sr-only">Copier</span>
          </Button>
        </div>
        {expiresAt ? <p className="text-xs text-muted-foreground">Valable jusqu&apos;à {formatDateTime(expiresAt)}.</p> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="extension-payload">Informations copiées depuis l&apos;extension</Label>
        <Textarea
          id="extension-payload"
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          rows={4}
          placeholder="Collez ici (Ctrl+V)"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={generatePassphrase} disabled={isGenerating}>
            Nouvelle phrase secrète
          </Button>
          <Button type="button" onClick={submitPayload} disabled={isSubmitting}>
            Valider
          </Button>
        </div>
      </div>
    </div>
  );
}
