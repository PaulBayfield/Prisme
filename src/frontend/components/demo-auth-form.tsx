"use client";

import * as React from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function DemoAuthForm({ className, ...props }: React.ComponentProps<"div">) {
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
              {isLoading ? "Connexion..." : "Essayer la démo"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <p className="text-center text-xs text-muted-foreground">
        Données fictives - aucune information réelle n&apos;est utilisée ou stockée.
      </p>
    </div>
  );
}
