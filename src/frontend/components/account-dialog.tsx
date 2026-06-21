"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { LogOut, Shield, User, UserCircle, type LucideIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Section = "profile" | "security";

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profil", icon: User },
  { id: "security", label: "Sécurité", icon: Shield },
];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

export function AccountDialog() {
  const { data: session } = useSession();
  const [section, setSection] = useState<Section>("profile");
  const initials = session?.user?.name?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <Dialog>
      <DialogTrigger nativeButton={false} render={<DropdownMenuItem closeOnClick={false} />}>
        <UserCircle />
        Compte
      </DialogTrigger>

      <DialogContent className="h-[min(440px,90svh)] w-[95vw] max-w-[95vw] gap-0 overflow-hidden p-0 sm:max-w-[620px]">
        <DialogTitle className="sr-only">Compte</DialogTitle>

        <div className="flex h-full flex-col overflow-hidden sm:flex-row">
          <div className="flex shrink-0 flex-row gap-0.5 overflow-x-auto border-b bg-muted/20 p-2 sm:w-44 sm:flex-col sm:border-b-0 sm:border-r">
            <div className="mb-1 hidden flex-col items-center gap-2 px-2 py-4 sm:flex">
              <Avatar size="lg">
                <AvatarFallback className="bg-primary text-base font-semibold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <p className="w-full truncate text-center text-xs font-medium text-muted-foreground">
                {session?.user?.name ?? "Utilisateur"}
              </p>
            </div>
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  "sm:w-full sm:text-left",
                  section === id
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {section === "profile" ? (
              <div className="space-y-4">
                <div className="mb-6">
                  <h3 className="text-base font-semibold">Profil</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">Informations de votre compte.</p>
                </div>
                <Field label="Nom" value={session?.user?.name ?? ""} />
                <Field label="Email" value={session?.user?.email ?? ""} />
                <div className="rounded-lg border p-4">
                  <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Session
                  </p>
                  <Badge variant="outline" className="text-xs">
                    Active
                  </Badge>
                </div>
              </div>
            ) : null}

            {section === "security" ? (
              <div className="space-y-4">
                <div className="mb-6">
                  <h3 className="text-base font-semibold">Sécurité</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Gérez votre session et vos identifiants.
                  </p>
                </div>
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  Pour changer votre mot de passe ou mettre à jour vos identifiants, rendez-vous sur les
                  paramètres de votre fournisseur d&apos;authentification.
                </div>
                <Button variant="destructive" className="w-full" onClick={() => signOut({ callbackUrl: "/" })}>
                  <LogOut className="size-4" />
                  Se déconnecter
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
