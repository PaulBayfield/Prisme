"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
}

// Same chevron-toggle pattern as help-dialog.tsx's dependency-updates block:
// a button row with a rotating ChevronDown, content revealed below inside a
// bordered container. Collapsed by default.
export function CollapsibleSection({ title, count, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="min-w-0 flex-1 text-sm font-medium">
          {title} ({count})
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="border-t p-4">{children}</div> : null}
    </div>
  );
}
