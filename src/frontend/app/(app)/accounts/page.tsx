import { getTranslations } from "next-intl/server";

import { AccountCard } from "@/components/account-card";
import { CollapsibleSection } from "@/components/collapsible-section";
import { getDateRangeFromCookies } from "@/lib/date-range";
import { getAccountBalanceChanges, getAccounts, getCurrentUserId } from "@/lib/data";
import type { Account, AccountBalanceChange } from "@/lib/types";

function AccountSection({
  title,
  accounts,
  changes,
}: {
  title: string;
  accounts: Account[];
  changes: Record<string, AccountBalanceChange>;
}) {
  if (accounts.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <AccountCard key={account.internalId} account={account} change={changes[account.internalId]} />
        ))}
      </div>
    </section>
  );
}

export default async function AccountsPage() {
  const userId = await getCurrentUserId();
  const t = await getTranslations("accounts");
  const range = await getDateRangeFromCookies();
  const [accounts, changes] = await Promise.all([
    getAccounts(userId),
    getAccountBalanceChanges(userId, range),
  ]);
  const visible = accounts.filter((account) => !account.excluded);
  const excluded = accounts.filter((account) => account.excluded);
  const current = visible.filter((account) => account.type === "current");
  const savingsHolder = visible.filter(
    (account) => account.type === "saving" && account.userRole === "holder",
  );
  const savingsOther = visible.filter(
    (account) => account.type === "saving" && account.userRole !== "holder",
  );

  return (
    <div className="flex flex-col gap-6">
      <AccountSection title={t("currentAccounts")} accounts={current} changes={changes} />
      <AccountSection title={t("savings")} accounts={savingsHolder} changes={changes} />
      <AccountSection title={t("savingsOther")} accounts={savingsOther} changes={changes} />
      {excluded.length > 0 ? (
        <CollapsibleSection title={t("excluded")} count={excluded.length}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {excluded.map((account) => (
              <AccountCard key={account.internalId} account={account} change={changes[account.internalId]} />
            ))}
          </div>
        </CollapsibleSection>
      ) : null}
    </div>
  );
}
