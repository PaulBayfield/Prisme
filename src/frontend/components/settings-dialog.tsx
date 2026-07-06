"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Coins, Eye, Globe, Palette, Settings, Sparkles, Tag, User, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useBlur } from "@/components/blur-provider";
import { CategoryManagement } from "@/components/category-management";
import { CategoryUseCasePicker } from "@/components/category-use-case-picker";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";
import { useDisplayCurrency } from "@/components/display-currency-provider";
import { LclConnectionPanel } from "@/components/lcl-connection-panel";
import { ThemeSelect } from "@/components/theme-select";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { setLocaleCookie } from "@/lib/actions";
import { CURRENCIES } from "@/lib/currencies";
import type { AssignedCategory, Category, CategoryUseCase } from "@/lib/types";
import { cn } from "@/lib/utils";

type Section = "appearance" | "privacy" | "currency" | "language" | "categories" | "use-cases" | "account";

const LANGUAGE_ITEMS = [
  { value: "fr", labelKey: "fr" as const },
  { value: "en", labelKey: "en" as const },
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

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function SettingsDialog({
  categories,
  categoryUseCases,
  hasLclCredentials,
  isDemoMode,
}: {
  categories: Category[];
  categoryUseCases: Record<CategoryUseCase, AssignedCategory[]>;
  hasLclCredentials: boolean;
  isDemoMode: boolean;
}) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const tCurrencies = useTranslations("currencies");
  const [isOpen, setIsOpen] = useState(false);
  const [section, setSection] = useState<Section>("appearance");
  const { blurred, setBlurred } = useBlur();
  const { code: displayCurrency, isPending: isCurrencyPending, setDisplayCurrency } = useDisplayCurrency();
  const locale = useLocale();
  const router = useRouter();
  const [isLocalePending, startLocaleTransition] = useTransition();

  function setLocale(next: string) {
    startLocaleTransition(async () => {
      try {
        await setLocaleCookie(next);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : tCommon("genericError"));
      }
    });
  }

  const CURRENCY_ITEMS = CURRENCIES.map((currency) => ({
    value: currency.code,
    label: `${currency.code} — ${tCurrencies(currency.code)}`,
  }));

  const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
    { id: "appearance", label: t("sections.appearance"), icon: Palette },
    { id: "privacy", label: t("sections.privacy"), icon: Eye },
    { id: "currency", label: t("sections.currency"), icon: Coins },
    { id: "language", label: t("sections.language"), icon: Globe },
    { id: "categories", label: t("sections.categories"), icon: Tag },
    { id: "use-cases", label: t("sections.useCases"), icon: Sparkles },
    { id: "account", label: t("sections.account"), icon: User },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<SidebarMenuButton tooltip={t("trigger")} />}>
        <Settings />
        <span>{t("trigger")}</span>
      </DialogTrigger>

      <DialogContent className="h-[min(560px,80svh)] w-[88vw] max-w-[88vw] gap-0 overflow-hidden p-0 sm:max-w-[800px]">
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <div className="flex h-full flex-col overflow-hidden sm:flex-row">
          <SectionNav active={section} onChange={setSection} sections={SECTIONS} title={t("title")} />

          <div className="flex-1 overflow-y-auto p-6">
            {section === "appearance" ? (
              <>
                <SectionHeader title={t("appearance.title")} description={t("appearance.description")} />
                <div className="space-y-2">
                  <Label>{t("appearance.theme")}</Label>
                  <ThemeSelect />
                </div>
              </>
            ) : null}

            {section === "privacy" ? (
              <>
                <SectionHeader title={t("privacy.title")} description={t("privacy.description")} />
                <div className="space-y-3">
                  <SettingRow
                    label={t("privacy.hideAmountsLabel")}
                    description={t("privacy.hideAmountsDescription")}
                  >
                    <Switch checked={blurred} onCheckedChange={setBlurred} />
                  </SettingRow>
                </div>
              </>
            ) : null}

            {section === "currency" ? (
              <>
                <SectionHeader title={t("currency.title")} description={t("currency.description")} />
                <div className="space-y-2">
                  <Label>{t("currency.displayCurrency")}</Label>
                  <Select
                    items={CURRENCY_ITEMS}
                    value={displayCurrency}
                    onValueChange={(next) => next && setDisplayCurrency(next)}
                    disabled={isCurrencyPending}
                  >
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.code} — {tCurrencies(currency.code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            {section === "language" ? (
              <>
                <SectionHeader title={t("language.title")} description={t("language.description")} />
                <div className="space-y-2">
                  <Label>{t("language.label")}</Label>
                  <Select
                    items={LANGUAGE_ITEMS.map((item) => ({ value: item.value, label: t(`language.${item.labelKey}`) }))}
                    value={locale}
                    onValueChange={(next) => next && setLocale(next)}
                    disabled={isLocalePending}
                  >
                    <SelectTrigger className="w-full sm:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {t(`language.${item.labelKey}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            {section === "categories" ? (
              <>
                <SectionHeader title={t("categories.title")} description={t("categories.description")} />
                <CategoryManagement categories={categories} />
              </>
            ) : null}

            {section === "use-cases" ? (
              <>
                <SectionHeader title={t("useCases.title")} description={t("useCases.description")} />
                <div className="space-y-5">
                  <SettingRow label={t("useCases.incomeLabel")} description={t("useCases.incomeDescription")}>
                    <CategoryUseCasePicker
                      useCase="income_forecast"
                      selected={categoryUseCases.income_forecast}
                      categories={categories}
                    />
                  </SettingRow>
                  <SettingRow
                    label={t("useCases.incomeExcludeLabel")}
                    description={t("useCases.incomeExcludeDescription")}
                  >
                    <CategoryUseCasePicker
                      useCase="income_exclude"
                      selected={categoryUseCases.income_exclude}
                      categories={categories}
                    />
                  </SettingRow>
                  <SettingRow label={t("useCases.savingsLabel")} description={t("useCases.savingsDescription")}>
                    <CategoryUseCasePicker
                      useCase="savings"
                      selected={categoryUseCases.savings}
                      categories={categories}
                    />
                  </SettingRow>
                </div>
              </>
            ) : null}

            {section === "account" ? (
              <div className="space-y-6">
                <SectionHeader title={t("account.title")} description={t("account.description")} />

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">{t("account.bankConnectionLabel")}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {t("account.bankConnectionDescription")}
                    </p>
                  </div>
                  <LclConnectionPanel initialHasCredentials={hasLclCredentials} isDemoMode={isDemoMode} />
                </div>

                <div className="space-y-3 rounded-lg border border-destructive/30 p-4">
                  <div>
                    <p className="text-sm font-medium">{t("account.deleteAccountLabel")}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {t("account.deleteAccountDescription")}
                    </p>
                  </div>
                  <DeleteAccountDialog isDemoMode={isDemoMode} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
