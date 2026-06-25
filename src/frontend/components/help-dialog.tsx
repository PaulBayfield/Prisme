"use client";

import { useState } from "react";
import {
  Activity,
  ArrowLeftRight,
  ArrowUpRight,
  Bug,
  CircleHelp,
  FolderGit2,
  Info,
  Keyboard,
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

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Aperçu", icon: LayoutDashboard },
  { id: "pages", label: "Pages", icon: LayoutGrid },
  { id: "shortcuts", label: "Raccourcis", icon: Keyboard },
  { id: "about", label: "À propos", icon: Info },
];

// Mirrors app-sidebar.tsx's NAV_ITEMS - same pages, same icons.
const PAGES = [
  { icon: LayoutDashboard, label: "Tableau de bord", desc: "Solde total, évolution du solde, comptes et transactions récentes en un coup d'œil." },
  { icon: Wallet, label: "Comptes", desc: "Comptes courants et d'épargne, avec leur solde et leur historique." },
  { icon: ArrowLeftRight, label: "Transactions", desc: "Historique complet des transactions, filtrable par compte et par statut (validées / en attente)." },
  { icon: PieChart, label: "Insights", desc: "Répartition des dépenses et revenus par catégorie, comparaisons mois par mois et année par année." },
  { icon: PiggyBank, label: "Budgets", desc: "Budgets mensuels par catégorie et suivi de ce qu'il reste à dépenser." },
  { icon: Target, label: "Objectifs", desc: "Objectifs d'épargne (vacances, achat, fonds d'urgence...) avec suivi de la progression vers le montant cible." },
  { icon: Landmark, label: "Patrimoine", desc: "Suivi manuel de vos actifs (immobilier, véhicules, placements, objets de valeur...) et de leur évolution." },
  { icon: Scale, label: "Trésorerie", desc: "Espèces en main et dettes (prêts, crédits), avec leur évolution combinée et le solde net." },
  { icon: Activity, label: "Monitoring", desc: "Historique des synchronisations du worker (réussies, échouées) et lancement manuel d'une synchronisation." },
];

const OVERVIEW_POINTS = [
  { label: "Données en direct", desc: "Chaque page interroge la base de données à chaque chargement - rien à rafraîchir manuellement." },
  { label: "Filtre de période", desc: "Le sélecteur de date dans l'en-tête s'applique au tableau de bord, aux transactions, aux insights, aux budgets et à la trésorerie." },
  { label: "Mode confidentialité", desc: "Masquez les montants avec l'icône œil de l'en-tête, ou activez-le par défaut dans Réglages → Confidentialité." },
  { label: "Thème", desc: "Choisissez clair, sombre ou système dans Réglages → Apparence." },
  { label: "Catégories", desc: "Organisez vos transactions par catégories personnalisées, avec une couleur par catégorie principale, depuis Réglages → Catégories." },
];

const SHORTCUTS = [{ keys: ["Ctrl", "B"], desc: "Réduire / agrandir la barre latérale" }];

const PROJECT_LINKS = [
  { icon: FolderGit2, label: "Dépôt GitHub", href: "https://github.com/PaulBayfield/Prisme" },
  { icon: Bug, label: "Signaler un problème", href: "https://github.com/PaulBayfield/Prisme/issues" },
];

function SectionNav({ active, onChange }: { active: Section; onChange: (section: Section) => void }) {
  return (
    <div className="flex shrink-0 flex-row gap-0.5 overflow-x-auto border-b bg-muted/20 p-2 sm:w-48 sm:flex-col sm:border-b-0 sm:border-r">
      <div className="mb-1 hidden px-3 py-2 sm:block">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Aide</p>
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

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs font-medium">
      {children}
    </kbd>
  );
}

const HelpDialog = () => {
  const [section, setSection] = useState<Section>("overview");

  return (
    <Dialog>
      <DialogTrigger render={<SidebarMenuButton tooltip="Aide" />}>
        <CircleHelp />
        <span>Aide</span>
      </DialogTrigger>

      <DialogContent className="h-[min(620px,90svh)] w-[95vw] max-w-[95vw] gap-0 overflow-hidden p-0 sm:max-w-[900px]">
        <DialogTitle className="sr-only">Aide</DialogTitle>

        <div className="flex h-full flex-col overflow-hidden sm:flex-row">
          <SectionNav active={section} onChange={setSection} />

          <div className="flex-1 overflow-y-auto p-6">
            {section === "overview" ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold">À propos de Prisme</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Prisme est un tableau de bord personnel qui regroupe vos comptes LCL, vos actifs et
                    dettes suivis manuellement, et vos espèces en main - tout au même endroit.
                  </p>
                </div>

                <div className="space-y-3">
                  {OVERVIEW_POINTS.map(({ label, desc }) => (
                    <div key={label} className="rounded-lg border p-4">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {section === "pages" ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold">Pages disponibles</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Accessibles depuis la barre latérale.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {PAGES.map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="flex items-start gap-3 rounded-lg border p-4">
                      <div className="shrink-0 rounded-md bg-muted p-1.5">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {section === "shortcuts" ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-semibold">Raccourcis clavier</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Accélérez les actions courantes sans passer par la souris.
                  </p>
                </div>
                <div className="space-y-2">
                  {SHORTCUTS.map(({ keys, desc }) => (
                    <div key={desc} className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <span className="text-sm">{desc}</span>
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
                  <h3 className="text-base font-semibold">À propos de Prisme</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tableau de bord personnel pour suivre vos comptes LCL, votre patrimoine et votre trésorerie.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <p className="text-sm font-medium">Version</p>
                  <Badge variant="outline">v{process.env.NEXT_PUBLIC_APP_VERSION}</Badge>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Crédits</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">Créé par Paul Bayfield</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Liens</p>
                  {PROJECT_LINKS.map(({ icon: Icon, label, href }) => (
                    <a
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" />
                        {label}
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
