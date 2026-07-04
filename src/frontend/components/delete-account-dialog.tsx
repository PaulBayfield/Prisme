"use client";

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteAccount } from "@/lib/actions";

const CONFIRM_WORD = "SUPPRIMER";

type Phase = "warn" | "confirm";

export function DeleteAccountDialog({ isDemoMode }: { isDemoMode?: boolean }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("warn");
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setPhase("warn");
    setConfirmText("");
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteAccount();
        await signOut({ callbackUrl: "/login" });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors de la suppression");
      }
    });
  }

  if (isDemoMode) {
    return (
      <Tooltip>
        <TooltipTrigger render={<Button variant="destructive" size="sm" disabled />}>
          <Trash2 className="size-4" />
          Supprimer mon compte
        </TooltipTrigger>
        <TooltipContent>Indisponible en mode démo</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
        <Trash2 className="size-4" />
        Supprimer mon compte
      </AlertDialogTrigger>
      <AlertDialogContent>
        {phase === "warn" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer votre compte ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Elle supprimera définitivement vos comptes synchronisés,
                transactions, catégories, budgets, patrimoine, dettes et espèces - absolument toutes les
                données liées à votre compte Prisme.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <Button onClick={() => setPhase("confirm")}>Continuer</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmation finale</AlertDialogTitle>
              <AlertDialogDescription>
                Pour confirmer, tapez « {CONFIRM_WORD} » ci-dessous. Il n&apos;y a pas de retour en arrière
                possible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="delete-account-confirm">Confirmation</Label>
              <Input
                id="delete-account-confirm"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder={CONFIRM_WORD}
                autoFocus
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleDelete}
                disabled={confirmText !== CONFIRM_WORD || isPending}
              >
                Supprimer définitivement
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
