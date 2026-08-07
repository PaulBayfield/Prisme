"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function YearSelect({ year, years }: { year: number; years: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(next: string | null) {
    if (!next) return;
    const params = new URLSearchParams(searchParams);
    params.set("year", next);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      items={years.map((y) => ({ value: String(y), label: String(y) }))}
      value={String(year)}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
