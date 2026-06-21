"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateDebtDetails } from "@/lib/actions";
import { DEBT_TYPES } from "@/lib/debt-types";
import type { Debt } from "@/lib/types";

export function EditDebtDialog({ debt }: { debt: Debt }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(debt.name);
  const [type, setType] = useState(debt.type);
  const [notes, setNotes] = useState(debt.notes ?? "");

  const typeItems = DEBT_TYPES.map((debtType) => ({ value: debtType.value, label: debtType.label }));

  function handleSave() {
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return;
    }

    startTransition(async () => {
      try {
        await updateDebtDetails(debt.id, { name, type, notes: notes || null });
        toast.success("Dette mise à jour");
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors de la mise à jour");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil className="size-4" />
        Modifier
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier la dette</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-debt-name">Nom</Label>
            <Input id="edit-debt-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select items={typeItems} value={type} onValueChange={(next) => next && setType(next)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-debt-notes">Notes</Label>
            <Textarea
              id="edit-debt-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>
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
