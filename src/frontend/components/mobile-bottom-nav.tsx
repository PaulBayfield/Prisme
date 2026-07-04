"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

import { NAV_ITEMS, NAV_ITEMS_SYSTEM, isNavItemActive } from "@/components/app-sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Only the first few NAV_ITEMS fit the bar with a label before it overflows
// on a phone screen - the rest (plus the system items) live behind "Plus"
// instead, same idea as a bottom-nav "More" tab on Instagram/banking apps.
const PRIMARY_COUNT = 4;
const PRIMARY_ITEMS = NAV_ITEMS.slice(0, PRIMARY_COUNT);
const MORE_ITEMS = [...NAV_ITEMS.slice(PRIMARY_COUNT), ...NAV_ITEMS_SYSTEM];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = MORE_ITEMS.some((item) => isNavItemActive(pathname, item.href));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {PRIMARY_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="Plus"
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
            isMoreActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          <MoreHorizontal className="size-5" />
          Plus
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <SheetHeader>
            <SheetTitle>Plus</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 px-4 pb-6">
            {MORE_ITEMS.map((item) => {
              const active = isNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg p-3 text-center text-xs font-medium transition-colors",
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <item.icon className="size-5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
