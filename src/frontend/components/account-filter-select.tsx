"use client";

import { useRouter } from "next/navigation";

import { buildHref, type Status } from "@/app/(app)/transactions/filters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Account } from "@/lib/types";

interface AccountFilterSelectProps {
  accounts: Account[];
  accountFilter: string;
  statusFilter: Status;
}

export function AccountFilterSelect({ accounts, accountFilter, statusFilter }: AccountFilterSelectProps) {
  const router = useRouter();

  const items = [
    { value: "all", label: "Tous les comptes" },
    ...accounts.map((account) => ({ value: account.internalId, label: account.label })),
  ];

  return (
    <Select
      items={items}
      value={accountFilter}
      onValueChange={(value) => {
        if (value) router.push(buildHref(value, statusFilter));
      }}
    >
      <SelectTrigger size="sm" className="w-full sm:w-56">
        <SelectValue placeholder="Tous les comptes" />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
