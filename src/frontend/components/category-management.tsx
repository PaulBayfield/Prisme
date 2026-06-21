"use client";

import { useState, useTransition } from "react";
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
import { createCategory, deleteCategory, renameCategory } from "@/lib/actions";
import type { Category } from "@/lib/types";

const DEFAULT_COLOR = "ef4444";

export function CategoryManagement({ categories }: { categories: Category[] }) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [color, setColor] = useState<string>(DEFAULT_COLOR);

  const roots = categories.filter((category) => category.parentId === null);
  const childrenOf = (id: number) => categories.filter((category) => category.parentId === id);

  const parentItems = [
    { value: "none", label: "Aucune (catégorie principale)" },
    ...roots.map((root) => ({ value: String(root.id), label: root.name })),
  ];

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Le nom de la catégorie est requis");
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
        toast.success("Catégorie créée");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors de la création");
      }
    });
  }

  function handleDelete(categoryId: number) {
    startTransition(async () => {
      try {
        await deleteCategory(categoryId);
        toast.success("Catégorie supprimée");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors de la suppression");
      }
    });
  }

  function handleRename(categoryId: number, newName: string) {
    startTransition(async () => {
      try {
        await renameCategory(categoryId, newName);
        toast.success("Catégorie renommée");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur lors du renommage");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Nouvelle catégorie</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Nom</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Transport"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Catégorie parente</Label>
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
            <Label>Couleur</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        ) : null}

        <Button size="sm" className="w-fit" onClick={handleCreate} disabled={isPending}>
          <Plus className="size-4" />
          Ajouter
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {roots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune catégorie pour le moment.</p>
        ) : (
          roots.map((root) => (
            <div key={root.id} className="rounded-lg border">
              <CategoryRow
                category={root}
                onRename={(newName) => handleRename(root.id, newName)}
                onDelete={() => handleDelete(root.id)}
                className="p-3"
                dotClassName="size-3"
              />
              {childrenOf(root.id).length > 0 ? (
                <div className="flex flex-col gap-1 border-t px-3 py-2">
                  {childrenOf(root.id).map((child) => (
                    <CategoryRow
                      key={child.id}
                      category={child}
                      onRename={(newName) => handleRename(child.id, newName)}
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
  onRename: (newName: string) => void;
  onDelete: () => void;
  className?: string;
  dotClassName?: string;
  muted?: boolean;
}

function CategoryRow({ category, onRename, onDelete, className, dotClassName, muted }: CategoryRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(category.name);

  function save() {
    if (draftName.trim() && draftName.trim() !== category.name) {
      onRename(draftName);
    }
    setIsEditing(false);
  }

  function cancel() {
    setDraftName(category.name);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className={`flex items-center justify-between gap-2 ${className}`}>
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
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={save}>
            <Check className="size-4" />
            <span className="sr-only">Enregistrer</span>
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={cancel}>
            <X className="size-4" />
            <span className="sr-only">Annuler</span>
          </Button>
        </div>
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
          <span className="sr-only">Renommer</span>
        </Button>
        <DeleteCategoryButton name={category.name} onConfirm={onDelete} />
      </div>
    </div>
  );
}

function DeleteCategoryButton({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Trash2 className="size-4" />
        <span className="sr-only">Supprimer</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer « {name} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Les transactions de cette catégorie ne seront plus catégorisées. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
