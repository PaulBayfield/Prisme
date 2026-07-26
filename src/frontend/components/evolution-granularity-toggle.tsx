"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EvolutionGranularity } from "@/lib/types";

const GRANULARITIES: EvolutionGranularity[] = ["day", "week", "month", "year"];

export function EvolutionGranularityToggle({ granularity }: { granularity: EvolutionGranularity }) {
  const t = useTranslations("insights.granularity");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setGranularity(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === "month") {
      // "month" is the default the page falls back to when the param is
      // absent - dropping it keeps the URL clean instead of always pinning it.
      params.delete("granularity");
    } else {
      params.set("granularity", value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Tabs value={granularity} onValueChange={(value) => setGranularity(String(value))}>
      <TabsList>
        {GRANULARITIES.map((value) => (
          <TabsTrigger key={value} value={value}>
            {t(value)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
