"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Search } from "lucide-react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { addCategoryUseCase, removeCategoryUseCase } from "@/lib/actions";
import type { AssignedCategory, Category, CategoryUseCase } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CategoryUseCasePickerProps {
  useCase: CategoryUseCase;
  selected: AssignedCategory[];
  categories: Category[];
}

// Multi-select category picker for wiring a built-in feature (income
// forecast, income exclusions, savings tracking) to whichever of the
// user's own categories should feed it - see category_use_cases in
// schema.sql. Modeled on CategoryPicker (components/category-picker.tsx),
// but controlled by `useCase` instead of a transaction row, and without
// the AI-prediction chips that component also renders.
export function CategoryUseCasePicker({ useCase, selected, categories }: CategoryUseCasePickerProps) {
  const t = useTranslations("categoryUseCasePicker");
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [optimisticSelected, setOptimisticSelected] = useOptimistic(selected);
  const selectedIds = new Set(optimisticSelected.map((category) => category.id));

  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
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

  function handleToggle(category: Category, isSelected: boolean) {
    startTransition(async () => {
      setOptimisticSelected((current) =>
        isSelected
          ? current.filter((selectedCategory) => selectedCategory.id !== category.id)
          : [...current, { id: category.id, name: category.name, color: category.effectiveColor }],
      );
      try {
        if (isSelected) {
          await removeCategoryUseCase(useCase, category.id);
        } else {
          await addCategoryUseCase(useCase, category.id);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("genericError"));
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-muted">
        {optimisticSelected.length === 0 ? (
          <span className="text-muted-foreground">{t("noCategory")}</span>
        ) : (
          optimisticSelected.map((category) => (
            <span key={category.id} className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />
              {category.name}
            </span>
          ))
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {categories.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("noCategoriesCreated")}</p>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-7 w-full rounded-sm border border-transparent bg-muted px-2 pl-7 text-sm outline-none focus-visible:border-ring"
              />
            </div>
            <ScrollArea className="max-h-56">
              <div className="flex flex-col gap-0.5 pr-1 max-h-56 overflow-y-auto">
                {filteredCategories.length === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("noResults")}</p>
                ) : (
                  filteredCategories.map((category) => {
                    const isSelected = selectedIds.has(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => handleToggle(category, isSelected)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted",
                          category.parentId !== null && "pl-6",
                        )}
                      >
                        <Check className={cn("size-3.5 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
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
