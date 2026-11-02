import { redirect } from "next/navigation";
import { KabrunLogo } from "@/components/brand/logo";
import { requireUser } from "@/modules/auth/current-user";
import { getServices } from "@/server/container";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Criar organização" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser("/onboarding");
  const params = await searchParams;
  const services = getServices();
  const memberships = await services.organizations.listForUser(user.id);
  if (memberships.length > 0 && params.new !== "1") redirect("/dashboard");

  // Nomear o provedor é o que torna o último passo compreensível: "provedor de pagamentos"
  // não diz a ninguém onde os documentos vão parar.
  const providerName = services.paymentProvider.type === "MOCK" ? "provedor simulado" : "Stripe";

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <KabrunLogo />
      <OnboardingForm defaultEmail={user.email} providerName={providerName} />
      <p className="text-xs text-muted-foreground">Você poderá convidar sua equipe e ajustar tudo depois.</p>
    </div>
  );
}
