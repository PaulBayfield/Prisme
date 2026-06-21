"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addTransactionCategory, removeTransactionCategory } from "@/lib/actions";
import type { AssignedCategory, Category } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CategoryPickerProps {
  rowId: number;
  assigned: AssignedCategory[];
  categories: Category[];
}

export function CategoryPicker({ rowId, assigned, categories }: CategoryPickerProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const assignedIds = new Set(assigned.map((category) => category.id));

  function handleToggle(categoryId: number, isAssigned: boolean) {
    startTransition(async () => {
      try {
        if (isAssigned) {
          await removeTransactionCategory(rowId, categoryId);
        } else {
          await addTransactionCategory(rowId, categoryId);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors de la mise à jour");
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={isPending}
        className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-muted disabled:opacity-50"
      >
        {assigned.length === 0 ? (
          <span className="text-muted-foreground">Sans catégorie</span>
        ) : (
          assigned.map((category) => (
            <span key={category.id} className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
              {category.name}
            </span>
          ))
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {categories.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">Aucune catégorie créée</p>
        ) : (
          categories.map((category) => {
            const isAssigned = assignedIds.has(category.id);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => handleToggle(category.id, isAssigned)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted",
                  category.parentId !== null && "pl-6",
                )}
              >
                <Check className={cn("size-3.5 shrink-0", isAssigned ? "opacity-100" : "opacity-0")} />
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: category.effectiveColor }}
                />
                {category.name}
              </button>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}
