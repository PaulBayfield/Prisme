"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { NAV_ITEMS, NAV_ITEMS_SYSTEM, NAV_ITEMS_TOOLS, isNavItemActive } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function NavLink({ href, label, icon: Icon, active, onClick }: {
  href: string;
  label: string;
  icon: (typeof NAV_ITEMS)[number]["icon"];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

export function MobileNavSheet() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="-ml-1 md:hidden"
        aria-label={t("openNavMenu")}
        onClick={() => setOpen(true)}
      >
        <Menu />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 gap-0 p-0">
          <SheetHeader className="flex-row items-center gap-2 border-b">
            <Image src="/logo-icon.png" alt="" width={28} height={28} className="size-7 shrink-0" />
            <SheetTitle>{t("brand")}</SheetTitle>
          </SheetHeader>

          <nav className="flex-1 overflow-y-auto p-3">
            <p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("groups.navigation")}
            </p>
            <div className="mb-3 flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={t(`items.${item.labelKey}`)}
                  icon={item.icon}
                  active={isNavItemActive(pathname, item.href)}
                  onClick={() => setOpen(false)}
                />
              ))}
            </div>

            <p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("groups.tools")}
            </p>
            <div className="mb-3 flex flex-col gap-0.5">
              {NAV_ITEMS_TOOLS.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={t(`items.${item.labelKey}`)}
                  icon={item.icon}
                  active={isNavItemActive(pathname, item.href)}
                  onClick={() => setOpen(false)}
                />
              ))}
            </div>

            <p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t("groups.system")}
            </p>
            <div className="flex flex-col gap-0.5">
              {NAV_ITEMS_SYSTEM.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={t(`items.${item.labelKey}`)}
                  icon={item.icon}
                  active={isNavItemActive(pathname, item.href)}
                  onClick={() => setOpen(false)}
                />
              ))}
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
