"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
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

type Phase = "warn" | "confirm";

export function DeleteAccountDialog({ isDemoMode }: { isDemoMode?: boolean }) {
  const t = useTranslations("deleteAccountDialog");
  const tCommon = useTranslations("common");
  const CONFIRM_WORD = t("confirmWord");
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
        toast.error(error instanceof Error ? error.message : t("deleteError"));
      }
    });
  }

  if (isDemoMode) {
    return (
      <Tooltip>
        <TooltipTrigger render={<Button variant="destructive" size="sm" disabled />}>
          <Trash2 className="size-4" />
          {t("deleteMyAccount")}
        </TooltipTrigger>
        <TooltipContent>{t("unavailableInDemo")}</TooltipContent>
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
        {t("deleteMyAccount")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        {phase === "warn" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("warnTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("warnDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
              <Button onClick={() => setPhase("confirm")}>{t("continue")}</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("finalConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("finalConfirmDescription", { word: CONFIRM_WORD })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="delete-account-confirm">{t("confirmationLabel")}</Label>
              <Input
                id="delete-account-confirm"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder={CONFIRM_WORD}
                autoFocus
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleDelete}
                disabled={confirmText !== CONFIRM_WORD || isPending}
              >
                {t("deletePermanently")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
