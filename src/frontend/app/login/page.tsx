import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";

import { DemoAuthForm } from "@/components/demo-auth-form";
import { UserAuthForm } from "@/components/user-auth-form";
import { authOptions } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/");
  }

  const t = await getTranslations("auth");
  const tNav = await getTranslations("nav");

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Image src="/logo-icon.png" alt="" width={48} height={48} priority />
          <div>
            <h1 className="text-lg font-semibold">{tNav("brand")}</h1>
            <p className="text-sm text-muted-foreground">
              {isDemoMode ? t("demoTagline") : t("tagline")}
            </p>
          </div>
        </div>
        {isDemoMode ? <DemoAuthForm /> : <UserAuthForm />}
      </div>
    </div>
  );
}
