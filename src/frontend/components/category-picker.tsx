"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Search } from "lucide-react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [query, setQuery] = useState("");
  const assignedIds = new Set(assigned.map((category) => category.id));

  const filteredCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(normalized));
  }, [categories, query]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  }

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
    <Popover open={open} onOpenChange={handleOpenChange}>
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
          <div className="flex flex-col gap-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher..."
                className="h-7 w-full rounded-sm border border-transparent bg-muted px-2 pl-7 text-sm outline-none focus-visible:border-ring"
              />
            </div>
            <ScrollArea className="max-h-56">
              <div className="flex flex-col gap-0.5 pr-1 max-h-56 overflow-y-auto">
                {filteredCategories.length === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">Aucun résultat</p>
                ) : (
                  filteredCategories.map((category) => {
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
              </div>
            </ScrollArea>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
