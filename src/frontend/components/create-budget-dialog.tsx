"use client";

import { useState, useTransition } from "react";
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
import { setBudget } from "@/lib/actions";
import type { Category } from "@/lib/types";

export function CreateBudgetDialog({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");

  const items = categories.map((category) => ({
    value: String(category.id),
    label: category.parentId !== null ? `↳ ${category.name}` : category.name,
  }));

  function reset() {
    setCategoryId("");
    setAmount("");
  }

  function handleCreate() {
    if (!categoryId) {
      toast.error("Choisissez une catégorie");
      return;
    }
    const parsedAmount = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Montant invalide");
      return;
    }

    startTransition(async () => {
      try {
        await setBudget(Number(categoryId), parsedAmount);
        toast.success("Budget créé");
        setOpen(false);
        reset();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors de la création");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />} disabled={items.length === 0}>
        <Plus className="size-4" />
        Ajouter un budget
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau budget</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select items={items} value={categoryId} onValueChange={(value) => value && setCategoryId(value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-amount">Montant mensuel (€)</Label>
            <Input
              id="budget-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="200"
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
