"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { createDebt } from "@/lib/actions";
import { DEBT_TYPES } from "@/lib/debt-types";

export function CreateDebtDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [type, setType] = useState<string>(DEBT_TYPES[0].value);
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  const typeItems = DEBT_TYPES.map((debtType) => ({ value: debtType.value, label: debtType.label }));

  function reset() {
    setName("");
    setType(DEBT_TYPES[0].value);
    setValue("");
    setNotes("");
  }

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    const parsedValue = Number(value.replace(",", "."));
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      toast.error("Valeur invalide");
      return;
    }

    startTransition(async () => {
      try {
        const debtId = await createDebt({
          name,
          type,
          notes: notes || null,
          value: parsedValue,
          valueCurrency: "EUR",
        });
        toast.success("Dette ajoutée");
        setOpen(false);
        reset();
        router.push(`/cash-debts/${debtId}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors de la création");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        Ajouter une dette
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle dette</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="debt-name">Nom</Label>
            <Input
              id="debt-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Crédit immobilier"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
              <Label htmlFor="debt-value">Solde restant (€)</Label>
              <Input
                id="debt-value"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="150000"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="debt-notes">Notes (optionnel)</Label>
            <Textarea
              id="debt-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={isPending}>
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
