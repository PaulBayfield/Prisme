"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
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

// Any server action that revalidates data makes Next.js treat it as a
// navigation, which resets scroll to the top of the route if it isn't
// already in view (next/dist/client/.../layout-router.js, handlePotentialScroll).
// That correction runs as part of the same commit that delivers the
// revalidated `assigned` prop, so keep re-asserting the pre-click position
// for a few frames *after* that prop lands instead of guessing a fixed delay
// from when our own action call resolves.
function pinScroll(y: number, framesLeft = 12) {
  if (framesLeft <= 0) return;
  requestAnimationFrame(() => {
    if (window.scrollY !== y) window.scrollTo(0, y);
    pinScroll(y, framesLeft - 1);
  });
}

export function CategoryPicker({ rowId, assigned, categories }: CategoryPickerProps) {
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [optimisticAssigned, setOptimisticAssigned] = useOptimistic(assigned);
  const assignedIds = new Set(optimisticAssigned.map((category) => category.id));

  const scrollBeforeToggleRef = useRef<number | null>(null);
  const prevAssignedRef = useRef(assigned);
  useEffect(() => {
    if (prevAssignedRef.current === assigned) return;
    prevAssignedRef.current = assigned;
    // Real (revalidated) data for this row just landed - this is the same
    // commit in which Next's own scroll correction fires, so it's already
    // happened by the time this effect runs. Undo it.
    if (scrollBeforeToggleRef.current !== null) {
      pinScroll(scrollBeforeToggleRef.current);
      scrollBeforeToggleRef.current = null;
    }
  }, [assigned]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Focus manually (rather than the `autoFocus` prop) so we can pass
    // preventScroll: true - the popover's floating-ui position isn't settled
    // yet on this first paint, so a plain .focus() would scroll the page to
    // bring the not-yet-repositioned popup into view.
    if (open) searchInputRef.current?.focus({ preventScroll: true });
  }, [open]);

  const filteredCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(normalized));
  }, [categories, query]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  }

  function handleToggle(category: Category, isAssigned: boolean) {
    scrollBeforeToggleRef.current = window.scrollY;
    startTransition(async () => {
      setOptimisticAssigned((current) =>
        isAssigned
          ? current.filter((assignedCategory) => assignedCategory.id !== category.id)
          : [...current, { id: category.id, name: category.name, color: category.effectiveColor }],
      );
      try {
        if (isAssigned) {
          await removeTransactionCategory(rowId, category.id);
        } else {
          await addTransactionCategory(rowId, category.id);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors de la mise à jour");
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-muted">
        {optimisticAssigned.length === 0 ? (
          <span className="text-muted-foreground">Sans catégorie</span>
        ) : (
          optimisticAssigned.map((category) => (
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
                ref={searchInputRef}
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
                        onClick={() => handleToggle(category, isAssigned)}
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
