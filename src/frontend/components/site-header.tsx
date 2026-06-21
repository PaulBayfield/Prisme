"use client";

import { usePathname } from "next/navigation";

import { BlurToggle } from "@/components/blur-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { TimeRangePicker } from "@/components/time-range-picker";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const TITLES: { href: string; title: string }[] = [
  { href: "/accounts", title: "Comptes" },
  { href: "/transactions", title: "Transactions" },
  { href: "/insights", title: "Insights" },
  { href: "/budgets", title: "Budgets" },
  { href: "/patrimoine", title: "Patrimoine" },
  { href: "/cash-debts", title: "Trésorerie" },
  { href: "/", title: "Tableau de bord" },
];

function titleForPathname(pathname: string): string {
  const match = TITLES.find((entry) =>
    entry.href === "/" ? pathname === "/" : pathname.startsWith(entry.href),
  );
  return match?.title ?? "Prisme";
}

export function SiteHeader({ initialRange }: { initialRange: { from: string; to: string } | null }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
      <SidebarTrigger className="-ml-1 hidden md:flex" />
      <Separator orientation="vertical" className="mr-2 hidden h-6 md:flex mt-auto mb-auto" />
      <h1 className="text-base font-medium">{titleForPathname(pathname)}</h1>
      <div className="ml-auto flex items-center gap-1">
        <TimeRangePicker initialRange={initialRange} />
        <BlurToggle />
        <ThemeToggle />
      </div>
    </header>
  );
}
