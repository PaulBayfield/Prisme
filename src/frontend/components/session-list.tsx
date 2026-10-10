"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Monitor, Smartphone, Tablet, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessions, revokeOtherSessions, revokeSession, setSessionDuration } from "@/lib/actions";
import { SESSION_DURATIONS } from "@/lib/session-duration";
import type { UserSession } from "@/lib/types";

const DEVICE_ICONS: Record<UserSession["deviceType"], LucideIcon> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

// Fetched on mount rather than passed down as props: the account dialog is
// rendered from the sidebar on every page, but this list is only worth a
// query once the Security tab is actually opened - and should be fresh then.
export function SessionList() {
  const t = useTranslations("account.security");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const [state, setState] = useState<{ sessions: UserSession[]; loadedAt: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function load() {
    try {
      const sessions = await getSessions();
      setState({ sessions, loadedAt: Date.now() });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getSessions()
      .then((sessions) => {
        if (!cancelled) setState({ sessions, loadedAt: Date.now() });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function run(action: () => Promise<void>, successMessage: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMessage);
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : tCommon("genericError"));
      }
    });
  }

  if (failed && !state) {
    return <p className="text-sm text-muted-foreground">{t("loadError")}</p>;
  }

  if (!state) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full sm:w-64" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const { sessions, loadedAt } = state;
  const current = sessions.find((session) => session.current);
  const others = sessions.filter((session) => !session.current);
  const hasProtected = others.some((session) => !session.revocable);
  const durationItems = SESSION_DURATIONS.map((duration) => ({
    value: String(duration.seconds),
    label: t(`durations.${duration.key}`),
  }));

  return (
    <div className="space-y-6">
      {current ? (
        <div className="space-y-2">
          <Label>{t("durationLabel")}</Label>
          <Select
            items={durationItems}
            value={String(current.durationSeconds)}
            onValueChange={(next) => next && run(() => setSessionDuration(Number(next)), t("durationUpdated"))}
            disabled={isPending}
          >
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {durationItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{t("durationDescription")}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium">{t("sessionsLabel")}</p>
        <ul className="divide-y rounded-lg border">
          {sessions.map((session) => {
            const Icon = DEVICE_ICONS[session.deviceType];
            const name = [session.browser, session.os].filter(Boolean).join(" · ") || t("unknownDevice");
            return (
              <li key={session.id} className="flex items-center gap-3 p-3">
                <Icon className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{name}</span>
                    {session.current ? (
                      <Badge variant="outline" className="text-xs">
                        {t("thisDevice")}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      session.ip,
                      session.current
                        ? null
                        : t("lastActive", { time: format.relativeTime(new Date(session.lastSeenAt), loadedAt) }),
                      t("signedIn", {
                        date: format.dateTime(new Date(session.createdAt), { dateStyle: "medium" }),
                      }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {session.current ? null : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending || !session.revocable}
                    onClick={() => run(() => revokeSession(session.id), t("revoked"))}
                  >
                    {t("revoke")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {hasProtected ? <p className="text-sm text-muted-foreground">{t("protectedNote")}</p> : null}
        {others.some((session) => session.revocable) ? (
          <Button
            variant="outline"
            className="w-full"
            disabled={isPending}
            onClick={() => run(revokeOtherSessions, t("othersRevoked"))}
          >
            {t("revokeOthers")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
