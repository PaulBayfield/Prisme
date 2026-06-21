import { AccountCard } from "@/components/account-card";
import { getAccounts, getCurrentUserId } from "@/lib/data";
import type { Account } from "@/lib/types";

function AccountSection({ title, accounts }: { title: string; accounts: Account[] }) {
  if (accounts.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <AccountCard key={account.internalId} account={account} />
        ))}
      </div>
    </section>
  );
}

export default async function AccountsPage() {
  const userId = await getCurrentUserId();
  const accounts = await getAccounts(userId);
  const current = accounts.filter((account) => account.type === "current");
  const savingsHolder = accounts.filter(
    (account) => account.type === "saving" && account.userRole === "holder",
  );
  const savingsOther = accounts.filter(
    (account) => account.type === "saving" && account.userRole !== "holder",
  );

  return (
    <div className="flex flex-col gap-6">
      <AccountSection title="Comptes courants" accounts={current} />
      <AccountSection title="Épargne" accounts={savingsHolder} />
      <AccountSection title="Épargne (autres titulaires)" accounts={savingsOther} />
    </div>
  );
}
