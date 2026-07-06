"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
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
import { updateAssetDetails } from "@/lib/actions";
import { ASSET_TYPES } from "@/lib/asset-types";
import type { Asset } from "@/lib/types";

export function EditAssetDialog({ asset }: { asset: Asset }) {
  const t = useTranslations("patrimoine");
  const tCommon = useTranslations("common");
  const tAssetTypes = useTranslations("assetTypes");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(asset.name);
  const [type, setType] = useState(asset.type);
  const [notes, setNotes] = useState(asset.notes ?? "");

  const typeItems = ASSET_TYPES.map((assetType) => ({
    value: assetType.value,
    label: tAssetTypes(assetType.labelKey),
  }));

  function handleSave() {
    if (!name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }

    startTransition(async () => {
      try {
        await updateAssetDetails(asset.id, { name, type, notes: notes || null });
        toast.success(t("updateSuccess"));
        setOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("updateError"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil className="size-4" />
        {t("edit")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editAsset")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-asset-name">{t("name")}</Label>
            <Input id="edit-asset-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("type")}</Label>
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
            <Label htmlFor="edit-asset-notes">{t("notes")}</Label>
            <Textarea
              id="edit-asset-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isPending}>
            {tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
