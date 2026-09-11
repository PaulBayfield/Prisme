"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { ColorPicker } from "@/components/color-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCategory, deleteCategory, updateCategory } from "@/lib/actions";
import type { Category } from "@/lib/types";

const DEFAULT_COLOR = "ef4444";

export function CategoryManagement({ categories }: { categories: Category[] }) {
  const t = useTranslations("categoryManagement");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [color, setColor] = useState<string>(DEFAULT_COLOR);

  const roots = categories.filter((category) => category.parentId === null);
  const childrenOf = (id: number) => categories.filter((category) => category.parentId === id);

  const parentItems = [
    { value: "none", label: t("noParent") },
    ...roots.map((root) => ({ value: String(root.id), label: root.name })),
  ];

  function handleCreate() {
    if (!name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }

    startTransition(async () => {
      try {
        await createCategory({
          name,
          color: `#${color}`,
          parentId: parentId === "none" ? null : Number(parentId),
        });
        setName("");
        toast.success(t("createSuccess"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("createError"));
      }
    });
  }

  function handleDelete(categoryId: number) {
    startTransition(async () => {
      try {
        await deleteCategory(categoryId);
        toast.success(t("deleteSuccess"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("deleteError"));
      }
    });
  }

  function handleUpdate(categoryId: number, input: { name: string; color: string | null }) {
    startTransition(async () => {
      try {
        await updateCategory(categoryId, input);
        toast.success(t("updateSuccess"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("updateError"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <p className="text-sm font-medium">{t("newCategory")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="category-name">{t("name")}</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("namePlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("parentCategory")}</Label>
            <Select items={parentItems} value={parentId} onValueChange={(value) => value && setParentId(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {parentItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {parentId === "none" ? (
          <div className="space-y-1.5">
            <Label>{t("color")}</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        ) : null}

        <Button size="sm" className="w-fit" onClick={handleCreate} disabled={isPending}>
          <Plus className="size-4" />
          {tCommon("add")}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {roots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          roots.map((root) => (
            <div key={root.id} className="rounded-lg border">
              <CategoryRow
                category={root}
                onUpdate={(input) => handleUpdate(root.id, input)}
                onDelete={() => handleDelete(root.id)}
                className="p-3"
                dotClassName="size-3"
                editableColor
              />
              {childrenOf(root.id).length > 0 ? (
                <div className="flex flex-col gap-1 border-t px-3 py-2">
                  {childrenOf(root.id).map((child) => (
                    <CategoryRow
                      key={child.id}
                      category={child}
                      onUpdate={(input) => handleUpdate(child.id, input)}
                      onDelete={() => handleDelete(child.id)}
                      className="py-1 pl-4"
                      dotClassName="size-2.5"
                      muted
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface CategoryRowProps {
  category: Category;
  onUpdate: (input: { name: string; color: string | null }) => void;
  onDelete: () => void;
  className?: string;
  dotClassName?: string;
  muted?: boolean;
  editableColor?: boolean;
}

function CategoryRow({ category, onUpdate, onDelete, className, dotClassName, muted, editableColor }: CategoryRowProps) {
  const t = useTranslations("categoryManagement");
  const tCommon = useTranslations("common");
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(category.name);
  const [draftColor, setDraftColor] = useState(() => (category.color ?? DEFAULT_COLOR).replace(/^#/, ""));

  function save() {
    const trimmed = draftName.trim();
    const nextColor = editableColor ? `#${draftColor}` : category.color;
    if (trimmed && (trimmed !== category.name || nextColor !== category.color)) {
      onUpdate({ name: trimmed, color: nextColor });
    }
    setIsEditing(false);
  }

  function cancel() {
    setDraftName(category.name);
    setDraftColor((category.color ?? DEFAULT_COLOR).replace(/^#/, ""));
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="flex flex-1 items-center gap-2">
          <span className={`shrink-0 rounded-full ${dotClassName}`} style={{ backgroundColor: category.effectiveColor }} />
          <Input
            autoFocus
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") save();
              if (event.key === "Escape") cancel();
            }}
            className="h-7 flex-1 text-sm"
          />
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={save}>
              <Check className="size-4" />
              <span className="sr-only">{tCommon("save")}</span>
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={cancel}>
              <X className="size-4" />
              <span className="sr-only">{tCommon("cancel")}</span>
            </Button>
          </div>
        </div>
        {editableColor ? (
          <div className="pl-5">
            <ColorPicker value={draftColor} onChange={setDraftColor} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <div className="flex items-center gap-2">
        <span className={`shrink-0 rounded-full ${dotClassName}`} style={{ backgroundColor: category.effectiveColor }} />
        <span className={muted ? "text-sm text-muted-foreground" : "text-sm font-medium"}>{category.name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => setIsEditing(true)}>
          <Pencil className="size-4" />
          <span className="sr-only">{t("edit")}</span>
        </Button>
        <DeleteCategoryButton name={category.name} onConfirm={onDelete} />
      </div>
    </div>
  );
}

function DeleteCategoryButton({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const t = useTranslations("categoryManagement");
  const tCommon = useTranslations("common");

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Trash2 className="size-4" />
        <span className="sr-only">{tCommon("delete")}</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle", { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{tCommon("delete")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
