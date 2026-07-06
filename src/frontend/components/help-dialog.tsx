"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  ArrowLeftRight,
  ArrowRightLeft,
  ArrowUpRight,
  Bug,
  CircleHelp,
  FolderGit2,
  Info,
  Keyboard,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  PieChart,
  PiggyBank,
  Scale,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { SidebarMenuButton } from "./ui/sidebar";

type Section = "overview" | "pages" | "shortcuts" | "about";

// Mirrors app-sidebar.tsx's NAV_ITEMS - same pages, same icons.
const PAGE_ICONS: { key: string; icon: LucideIcon }[] = [
  { key: "dashboard", icon: LayoutDashboard },
  { key: "accounts", icon: Wallet },
  { key: "transactions", icon: ArrowLeftRight },
  { key: "insights", icon: PieChart },
  { key: "budgets", icon: PiggyBank },
  { key: "goals", icon: Target },
  { key: "patrimoine", icon: Landmark },
  { key: "cashDebts", icon: Scale },
  { key: "currencyExchange", icon: ArrowRightLeft },
  { key: "monitoring", icon: Activity },
];

const OVERVIEW_POINT_KEYS = ["liveData", "dateFilter", "privacyMode", "theme", "categories"] as const;

const SHORTCUTS = [{ keys: ["Ctrl", "B"], descKey: "toggleSidebar" as const }];

const PROJECT_LINKS = [
  { icon: FolderGit2, labelKey: "githubRepo" as const, href: "https://github.com/PaulBayfield/Prisme" },
  { icon: Bug, labelKey: "reportIssue" as const, href: "https://github.com/PaulBayfield/Prisme/issues" },
];

const EXTERNAL_SERVICES = [
  { icon: Landmark, label: "LCL", descKey: "lcl" as const, href: "https://www.lcl.fr/" },
  { icon: KeyRound, label: "Authentik", descKey: "authentik" as const, href: "https://goauthentik.io" },
  { icon: ArrowRightLeft, label: "Frankfurter", descKey: "frankfurter" as const, href: "https://frankfurter.dev" },
];

function SectionNav({
  active,
  onChange,
  sections,
  title,
}: {
  active: Section;
  onChange: (section: Section) => void;
  sections: { id: Section; label: string; icon: LucideIcon }[];
  title: string;
}) {
  return (
    <div className="flex shrink-0 flex-row gap-0.5 overflow-x-auto border-b bg-muted/20 p-2 sm:w-48 sm:flex-col sm:border-b-0 sm:border-r">
      <div className="mb-1 hidden px-3 py-2 sm:block">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</p>
      </div>
      {sections.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors",
            "sm:w-full sm:text-left",
            active === id
              ? "bg-background font-medium text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
          )}
        >
          <Icon className="size-4 shrink-0" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs font-medium">
      {children}
    </kbd>
  );
}

const HelpDialog = () => {
  const [section, setSection] = useState<Section>("overview");
  const t = useTranslations("help");

  const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
    { id: "overview", label: t("sections.overview"), icon: LayoutDashboard },
    { id: "pages", label: t("sections.pages"), icon: LayoutGrid },
    { id: "shortcuts", label: t("sections.shortcuts"), icon: Keyboard },
    { id: "about", label: t("sections.about"), icon: Info },
  ];

  return (
    <Dialog>
      <DialogTrigger render={<SidebarMenuButton tooltip={t("trigger")} />}>
        <CircleHelp />
        <span>{t("trigger")}</span>
      </DialogTrigger>

      <DialogContent className="h-[min(620px,90svh)] w-[95vw] max-w-[95vw] gap-0 overflow-hidden p-0 sm:max-w-[900px]">
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>

        <div className="flex h-full flex-col overflow-hidden sm:flex-row">
          <SectionNav active={section} onChange={setSection} sections={SECTIONS} title={t("sidebarLabel")} />

          <div className="flex-1 overflow-y-auto p-6">
            {section === "overview" ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold">{t("aboutTitle")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t("overview.description")}</p>
                </div>

                <div className="space-y-3">
                  {OVERVIEW_POINT_KEYS.map((key) => (
                    <div key={key} className="rounded-lg border p-4">
                      <p className="text-sm font-medium">{t(`overview.points.${key}.label`)}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{t(`overview.points.${key}.desc`)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {section === "pages" ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold">{t("pages.title")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t("pages.description")}</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {PAGE_ICONS.map(({ key, icon: Icon }) => (
                    <div key={key} className="flex items-start gap-3 rounded-lg border p-4">
                      <div className="shrink-0 rounded-md bg-muted p-1.5">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t(`pages.${key}.label`)}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {t(`pages.${key}.desc`)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {section === "shortcuts" ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold">{t("shortcuts.title")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t("shortcuts.description")}</p>
                </div>
                <div className="space-y-2">
                  {SHORTCUTS.map(({ keys, descKey }) => (
                    <div key={descKey} className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <span className="text-sm">{t(`shortcuts.${descKey}`)}</span>
                      <div className="flex items-center gap-1">
                        {keys.map((key, index) => (
                          <span key={key} className="flex items-center gap-1">
                            <Kbd>{key}</Kbd>
                            {index < keys.length - 1 && <span className="text-xs text-muted-foreground">+</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {section === "about" ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold">{t("aboutTitle")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t("about.description")}</p>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <p className="text-sm font-medium">{t("about.version")}</p>
                  <Badge variant="outline">v{process.env.NEXT_PUBLIC_APP_VERSION}</Badge>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">{t("about.credits")}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t("about.createdBy")}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("about.externalApis")}</p>
                  {EXTERNAL_SERVICES.map(({ icon: Icon, label, descKey, href }) => (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-muted"
                    >
                      <span className="flex items-start gap-2">
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span>
                          <span className="block font-medium">{label}</span>
                          <span className="block text-xs text-muted-foreground">
                            {t(`about.services.${descKey}`)}
                          </span>
                        </span>
                      </span>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                    </a>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("about.links")}</p>
                  {PROJECT_LINKS.map(({ icon: Icon, labelKey, href }) => (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        {t(`about.${labelKey}`)}
                      </span>
                      <ArrowUpRight className="size-4 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HelpDialog;
