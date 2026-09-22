import { redirect } from "next/navigation";
import { HypeiLogo } from "@/components/brand/logo";
import { requireUser } from "@/modules/auth/current-user";
import { getServices } from "@/server/container";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Criar organização" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser("/onboarding");
  const params = await searchParams;
  const memberships = await getServices().organizations.listForUser(user.id);
  if (memberships.length > 0 && params.new !== "1") redirect("/dashboard");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <HypeiLogo />
      <OnboardingForm defaultEmail={user.email} />
      <p className="text-xs text-muted-foreground">Você poderá convidar sua equipe e ajustar tudo depois.</p>
    </div>
  );
}
