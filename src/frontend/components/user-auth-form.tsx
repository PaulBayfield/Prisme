"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldSeparator } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function UserAuthForm({ className, ...props }: React.ComponentProps<"div">) {
  const t = useTranslations("auth");
  const [isLoading, setIsLoading] = React.useState(false);

  function onSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    setIsLoading(true);

    signIn("prisme", { callbackUrl: "/" });

    // signIn() redirects the whole page to Authentik - this is only a
    // fallback in case that redirect never fires (e.g. misconfiguration),
    // so the button doesn't stay disabled forever.
    setTimeout(() => {
      setIsLoading(false);
    }, 100000);
  }

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t("connecting") : t("signInWithAuthentik")}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          <span>{t("waitingForAuth")}</span>
        </div>
      ) : (
        <>
          <FieldSeparator>{t("orRequestAccess")}</FieldSeparator>
          <Button
            variant="outline"
            type="button"
            disabled={isLoading}
            className="w-full"
            nativeButton={false}
            render={<Link href="mailto:paul@bayfield.dev" target="_blank" rel="noreferrer" />}
          >
            {t("email")}
          </Button>
        </>
      )}
    </div>
  );
}
