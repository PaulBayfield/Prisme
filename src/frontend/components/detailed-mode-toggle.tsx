"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListTree } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DetailedModeToggle({ detailed }: { detailed: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggle() {
    const params = new URLSearchParams(searchParams);
    if (detailed) {
      params.delete("detailed");
    } else {
      params.set("detailed", "true");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Button variant={detailed ? "default" : "outline"} size="sm" onClick={toggle}>
      <ListTree className="size-4" />
      Mode détaillé
    </Button>
  );
}
