"use client";

import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { setAccountExcluded } from "@/lib/actions";
import type { Account } from "@/lib/types";

interface AccountVisibilityListProps {
  accounts: Account[];
}

// Per-account "exclude from the app" toggle, e.g. for accounts the user only
// holds power-of-attorney over and that aren't really theirs. Modeled on
// CategoryUseCasePicker's optimistic-update pattern (components/category-
// use-case-picker.tsx), but as a flat list of switches instead of a popover
// multi-select. Excluding an account only stops it feeding dashboards,
// budgets, reports and the ML categorizer/forecaster (see
// visible_account_users in schema.sql) - it stays visible here and on the
// accounts page.
export function AccountVisibilityList({ accounts }: AccountVisibilityListProps) {
  const t = useTranslations("accountVisibilityList");
  const [, startTransition] = useTransition();
  const [optimisticAccounts, setOptimisticExcluded] = useOptimistic(
    accounts,
    (state, { internalId, excluded }: { internalId: string; excluded: boolean }) =>
      state.map((account) => (account.internalId === internalId ? { ...account, excluded } : account)),
  );

  function handleToggle(account: Account, excluded: boolean) {
    startTransition(async () => {
      setOptimisticExcluded({ internalId: account.internalId, excluded });
      try {
        await setAccountExcluded(account.internalId, excluded);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("genericError"));
      }
    });
  }

  if (optimisticAccounts.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noAccounts")}</p>;
  }

  return (
    <div className="space-y-1">
      {optimisticAccounts.map((account) => (
        <div key={account.internalId} className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{account.label}</p>
            <p className="truncate text-xs text-muted-foreground">{account.iban}</p>
          </div>
          <Switch
            checked={account.excluded}
            onCheckedChange={(checked) => handleToggle(account, checked)}
            aria-label={t("excludeSwitchLabel", { account: account.label })}
          />
        </div>
      ))}
    </div>
  );
}
