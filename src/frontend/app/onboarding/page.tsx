import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding-wizard";
import { getCategories, getCurrentUserId, getHasLclCredentials, getOnboardingStatus } from "@/lib/data";

export default async function OnboardingPage() {
  const userId = await getCurrentUserId();
  const [{ onboardedAt }, categories, hasLclCredentials] = await Promise.all([
    getOnboardingStatus(userId),
    getCategories(userId),
    getHasLclCredentials(userId),
  ]);

  if (onboardedAt) {
    redirect("/");
  }

  return <OnboardingWizard categories={categories} hasLclCredentials={hasLclCredentials} />;
}
