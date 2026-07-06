"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { signOut, useSession } from "next-auth/react";
import { LogOut, Shield, User, UserCircle, type LucideIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Section = "profile" | "security";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function formatSessionDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${seconds} s`;
}

export function AccountDialog({ trigger }: { trigger?: React.ReactElement } = {}) {
  const t = useTranslations("account");
  const { data: session } = useSession();
  const [section, setSection] = useState<Section>("profile");
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const initials = session?.user?.name?.slice(0, 2).toUpperCase() ?? "??";

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [open]);

  const sessionDuration = session?.loginTime ? now - session.loginTime : null;

  const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
    { id: "profile", label: t("sections.profile"), icon: User },
    { id: "security", label: t("sections.security"), icon: Shield },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={!trigger}
        render={trigger ?? <DropdownMenuItem closeOnClick={false} />}
      >
        <UserCircle />
        {t("trigger")}
      </DialogTrigger>

      <DialogContent className="h-[min(420px,80svh)] w-[88vw] max-w-[88vw] gap-0 overflow-hidden p-0 sm:max-w-[620px]">
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>

        <div className="flex h-full flex-col overflow-hidden sm:flex-row">
          <div className="flex shrink-0 flex-row gap-0.5 overflow-x-auto border-b bg-muted/20 p-2 sm:w-44 sm:flex-col sm:border-b-0 sm:border-r">
            <div className="mb-1 hidden flex-col items-center gap-2 px-2 py-4 sm:flex">
              <Avatar size="lg">
                <AvatarFallback className="bg-primary text-base font-semibold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <p className="w-full truncate text-center text-xs font-medium text-muted-foreground">
                {session?.user?.name ?? t("fallbackName")}
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
                  <h3 className="text-base font-semibold">{t("profile.title")}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t("profile.description")}</p>
                </div>
                <Field label={t("profile.name")} value={session?.user?.name ?? ""} />
                <Field label={t("profile.email")} value={session?.user?.email ?? ""} />
                <div className="rounded-lg border p-4">
                  <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {t("profile.sessionActive")}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {t("profile.active")}
                    </Badge>
                    {sessionDuration !== null ? (
                      <span className="text-sm text-muted-foreground">
                        {t("profile.since", { duration: formatSessionDuration(sessionDuration) })}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {section === "security" ? (
              <div className="space-y-4">
                <div className="mb-6">
                  <h3 className="text-base font-semibold">{t("security.title")}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t("security.description")}</p>
                </div>
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">{t("security.note")}</div>
                <Button variant="destructive" className="w-full" onClick={() => signOut({ callbackUrl: "/" })}>
                  <LogOut className="size-4" />
                  {t("signOut")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
