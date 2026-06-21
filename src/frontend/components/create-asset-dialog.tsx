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
import { createAsset } from "@/lib/actions";
import { ASSET_TYPES } from "@/lib/asset-types";

export function CreateAssetDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [type, setType] = useState<string>(ASSET_TYPES[0].value);
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  const typeItems = ASSET_TYPES.map((assetType) => ({ value: assetType.value, label: assetType.label }));

  function reset() {
    setName("");
    setType(ASSET_TYPES[0].value);
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
        const assetId = await createAsset({
          name,
          type,
          notes: notes || null,
          value: parsedValue,
          valueCurrency: "EUR",
        });
        toast.success("Actif ajouté");
        setOpen(false);
        reset();
        router.push(`/patrimoine/${assetId}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors de la création");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" />
        Ajouter un actif
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvel actif</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="asset-name">Nom</Label>
            <Input
              id="asset-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Maison principale"
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
              <Label htmlFor="asset-value">Valeur (€)</Label>
              <Input
                id="asset-value"
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="250000"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asset-notes">Notes (optionnel)</Label>
            <Textarea
              id="asset-notes"
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
