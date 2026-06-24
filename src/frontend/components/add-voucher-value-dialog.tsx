"use client";

import { useState, useTransition } from "react";
import { Ticket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setVoucherOnHand } from "@/lib/actions";

export function AddVoucherValueDialog({ currentValue, currency }: { currentValue: number; currency: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(String(currentValue));

  function handleSave() {
    const parsedValue = Number(value.replace(",", "."));
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      toast.error("Valeur invalide");
      return;
    }

    startTransition(async () => {
      try {
        await setVoucherOnHand(parsedValue, currency);
        toast.success("Chèques vacances mis à jour");
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors de la mise à jour");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setValue(String(currentValue));
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Ticket className="size-4" />
        Mettre à jour
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chèques vacances</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="new-voucher-value">Valeur ({currency})</Label>
          <Input
            id="new-voucher-value"
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isPending}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
