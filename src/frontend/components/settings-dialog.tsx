"use client";

import { useState } from "react";
import { Coins, Eye, Palette, Settings, Sparkles, Tag, User, type LucideIcon } from "lucide-react";

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
import { CURRENCIES } from "@/lib/currencies";
import type { AssignedCategory, Category, CategoryUseCase } from "@/lib/types";
import { cn } from "@/lib/utils";

type Section = "appearance" | "privacy" | "currency" | "categories" | "use-cases" | "account";

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "appearance", label: "Apparence", icon: Palette },
  { id: "privacy", label: "Confidentialité", icon: Eye },
  { id: "currency", label: "Devise", icon: Coins },
  { id: "categories", label: "Catégories", icon: Tag },
  { id: "use-cases", label: "Fonctionnalités", icon: Sparkles },
  { id: "account", label: "Compte", icon: User },
];

const CURRENCY_ITEMS = CURRENCIES.map((currency) => ({
  value: currency.code,
  label: `${currency.code} — ${currency.label}`,
}));

function SectionNav({ active, onChange }: { active: Section; onChange: (section: Section) => void }) {
  return (
    <div className="flex shrink-0 flex-row gap-0.5 overflow-x-auto border-b bg-muted/20 p-2 sm:w-48 sm:flex-col sm:border-b-0 sm:border-r">
      <div className="mb-1 hidden px-3 py-2 sm:block">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Réglages</p>
      </div>
      {SECTIONS.map(({ id, label, icon: Icon }) => (
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
  const [isOpen, setIsOpen] = useState(false);
  const [section, setSection] = useState<Section>("appearance");
  const { blurred, setBlurred } = useBlur();
  const { code: displayCurrency, isPending: isCurrencyPending, setDisplayCurrency } = useDisplayCurrency();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<SidebarMenuButton tooltip="Réglages" />}>
        <Settings />
        <span>Réglages</span>
      </DialogTrigger>

      <DialogContent className="h-[min(560px,80svh)] w-[88vw] max-w-[88vw] gap-0 overflow-hidden p-0 sm:max-w-[800px]">
        <DialogTitle className="sr-only">Réglages</DialogTitle>
        <div className="flex h-full flex-col overflow-hidden sm:flex-row">
          <SectionNav active={section} onChange={setSection} />

          <div className="flex-1 overflow-y-auto p-6">
            {section === "appearance" ? (
              <>
                <SectionHeader title="Apparence" description="Personnalisez l'apparence du tableau de bord." />
                <div className="space-y-2">
                  <Label>Thème</Label>
                  <ThemeSelect />
                </div>
              </>
            ) : null}

            {section === "privacy" ? (
              <>
                <SectionHeader
                  title="Confidentialité"
                  description="Contrôlez les informations sensibles affichées à l'écran."
                />
                <div className="space-y-3">
                  <SettingRow
                    label="Masquer les montants"
                    description="Masque les valeurs monétaires par défaut. Basculez individuellement avec l'icône d'œil dans l'en-tête."
                  >
                    <Switch checked={blurred} onCheckedChange={setBlurred} />
                  </SettingRow>
                </div>
              </>
            ) : null}

            {section === "currency" ? (
              <>
                <SectionHeader
                  title="Devise"
                  description="Toutes les données sont enregistrées en euros - choisissez une devise d'affichage pour convertir automatiquement les montants sur l'ensemble du site, au taux du jour."
                />
                <div className="space-y-2">
                  <Label>Devise d&apos;affichage</Label>
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
                          {currency.code} — {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            {section === "categories" ? (
              <>
                <SectionHeader
                  title="Catégories de transactions"
                  description="Organisez vos transactions par catégories, avec une couleur par catégorie principale."
                />
                <CategoryManagement categories={categories} />
              </>
            ) : null}

            {section === "use-cases" ? (
              <>
                <SectionHeader
                  title="Fonctionnalités"
                  description="Choisissez quelles catégories alimentent chaque fonctionnalité. Plusieurs catégories peuvent être sélectionnées pour chacune."
                />
                <div className="space-y-5">
                  <SettingRow
                    label="Salaire"
                    description="Catégories comptées dans la prévision de revenus du mois."
                  >
                    <CategoryUseCasePicker
                      useCase="income_forecast"
                      selected={categoryUseCases.income_forecast}
                      categories={categories}
                    />
                  </SettingRow>
                  <SettingRow
                    label="Remboursements"
                    description="Catégories exclues du total de revenus (Insights)."
                  >
                    <CategoryUseCasePicker
                      useCase="income_exclude"
                      selected={categoryUseCases.income_exclude}
                      categories={categories}
                    />
                  </SettingRow>
                  <SettingRow label="Épargne" description="Catégories comptées comme épargne (Insights).">
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
                <SectionHeader title="Compte" description="Gérez votre compte Prisme." />

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Connexion bancaire</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Mettez à jour vos identifiants LCL si votre session a expiré ou si la synchronisation a
                      cessé de fonctionner.
                    </p>
                  </div>
                  <LclConnectionPanel initialHasCredentials={hasLclCredentials} isDemoMode={isDemoMode} />
                </div>

                <div className="space-y-3 rounded-lg border border-destructive/30 p-4">
                  <div>
                    <p className="text-sm font-medium">Supprimer mon compte</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Supprime définitivement votre compte et toutes les données associées : comptes
                      synchronisés, transactions, catégories, budgets, patrimoine, dettes et espèces. Cette
                      action est irréversible.
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
