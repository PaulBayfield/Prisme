import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-24 text-center">
      <SearchX className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">Page introuvable</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Cette page n&apos;existe pas ou a été déplacée.
      </p>
      <Button size="sm" className="mt-2" nativeButton={false} render={<Link href="/" />}>
        Retour au tableau de bord
      </Button>
    </div>
  );
}
