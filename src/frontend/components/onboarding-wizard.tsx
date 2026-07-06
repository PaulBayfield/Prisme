"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";

import { CategoryManagement } from "@/components/category-management";
import { CredentialsStep } from "@/components/onboarding-credentials-step";
import { ThemeSelect } from "@/components/theme-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { completeOnboarding } from "@/lib/actions";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3;

function StepIndicator({ step, steps }: { step: Step; steps: { id: Step; label: string }[] }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map(({ id, label }, index) => (
        <div key={id} className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                step === id
                  ? "bg-primary text-primary-foreground"
                  : step > id
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {step > id ? <Check className="size-3.5" /> : id}
            </div>
            <span className={cn("hidden text-sm sm:inline", step === id ? "font-medium" : "text-muted-foreground")}>
              {label}
            </span>
          </div>
          {index < steps.length - 1 ? <div className="h-px w-6 bg-border sm:w-10" /> : null}
        </div>
      ))}
    </div>
  );
}

export function OnboardingWizard({
  categories,
  hasLclCredentials,
}: {
  categories: Category[];
  hasLclCredentials: boolean;
}) {
  const t = useTranslations("onboarding");
  const [step, setStep] = useState<Step>(1);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const STEPS: { id: Step; label: string }[] = [
    { id: 1, label: t("steps.bankConnection") },
    { id: 2, label: t("steps.categories") },
    { id: 3, label: t("steps.appearance") },
  ];

  function back() {
    setStep((current) => (current > 1 ? ((current - 1) as Step) : current));
  }

  function finish() {
    startTransition(async () => {
      try {
        await completeOnboarding();
        router.push("/");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("genericError"));
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 p-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <Image src="/logo-icon.png" alt="" width={40} height={40} priority />
        <h1 className="text-lg font-semibold">{t("welcome")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <StepIndicator step={step} steps={STEPS} />

      <Card>
        <CardContent className="space-y-6 p-6">
          {step === 1 ? (
            <CredentialsStep initialHasCredentials={hasLclCredentials} onNext={() => setStep(2)} />
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">{t("steps.categories")}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{t("categoriesStep.description")}</p>
              </div>
              <CategoryManagement categories={categories} />
              <div className="flex items-center justify-between gap-2 border-t pt-4">
                <Button variant="ghost" onClick={back}>
                  <ArrowLeft className="size-4" />
                  {t("back")}
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setStep(3)}>
                    {t("skipStep")}
                  </Button>
                  <Button onClick={() => setStep(3)}>{t("continue")}</Button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">{t("steps.appearance")}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{t("appearanceStep.description")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("appearanceStep.theme")}</Label>
                <ThemeSelect />
              </div>
              <div className="flex items-center justify-between gap-2 border-t pt-4">
                <Button variant="ghost" onClick={back} disabled={isPending}>
                  <ArrowLeft className="size-4" />
                  {t("back")}
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={finish} disabled={isPending}>
                    {t("skipStep")}
                  </Button>
                  <Button onClick={finish} disabled={isPending}>
                    {t("finish")}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
