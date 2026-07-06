import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-24 text-center">
      <SearchX className="size-8 text-muted-foreground" />
      <p className="text-sm font-medium">{t("notFoundTitle")}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{t("notFoundDescription")}</p>
      <Button size="sm" className="mt-2" nativeButton={false} render={<Link href="/" />}>
        {t("backToDashboard")}
      </Button>
    </div>
  );
}
