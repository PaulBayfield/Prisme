"use client";

import { Eye, EyeOff } from "lucide-react";

import { useBlur } from "@/components/blur-provider";
import { Button } from "@/components/ui/button";

export function BlurToggle() {
  const { blurred, toggle } = useBlur();

  return (
    <Button variant="outline" size="icon" aria-label="Masquer les montants" onClick={toggle}>
      {blurred ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </Button>
  );
}
