import Link from "next/link";
import { Vault, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDisplayCurrency } from "@/lib/display-currency";
import { formatCurrency } from "@/lib/format";
import type { Account } from "@/lib/types";

export async function AccountCard({ account }: { account: Account }) {
  const { code, rate } = await getDisplayCurrency();
  const Icon = account.type === "saving" ? Vault : Wallet;

  return (
    <Link href={`/accounts/${account.internalId}`} className="block">
      <Card className="transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium">{account.label}</p>
              <p className="blur-sensitive text-xs text-muted-foreground">{account.iban}</p>
            </div>
          </div>
          <div className="flex flex-row items-end gap-1">
            {account.bankLabel && (
              <Badge variant="outline" className="capitalize">
                {account.bankLabel}
              </Badge>
            )}
            <Badge variant="secondary" className="capitalize">
              {account.type === "saving" ? "Épargne" : "Courant"}
            </Badge>
            {account.status === "SUCCES" && (
              <Badge variant="default" className="capitalize">
                Actif
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="blur-sensitive text-2xl font-semibold tabular-nums">
            {formatCurrency(account.amount * rate, code)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
