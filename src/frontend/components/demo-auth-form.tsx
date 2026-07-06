"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function DemoAuthForm({ className, ...props }: React.ComponentProps<"div">) {
  const t = useTranslations("auth");
  const [isLoading, setIsLoading] = React.useState(false);

  function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    setIsLoading(true);
    signIn("demo", { callbackUrl: "/" });
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Spinner /> : null}
              {isLoading ? t("connecting") : t("tryDemo")}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <p className="text-center text-xs text-muted-foreground">{t("demoDisclaimer")}</p>
    </div>
  );
}
