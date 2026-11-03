import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KabrunLogo } from "@/components/brand/logo";
import { getAppDictionary } from "@/lib/i18n/app";
import { AppDictionaryProvider } from "@/lib/i18n/app/provider";
import { appLocale } from "@/lib/i18n/app/server";
import { localizedCountries } from "@/lib/i18n/countries";
import { requireUser } from "@/modules/auth/current-user";
import { getServices } from "@/server/container";
import { OnboardingForm } from "./onboarding-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).onboarding.title };
}

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser("/onboarding");
  const params = await searchParams;
  const services = getServices();
  const memberships = await services.organizations.listForUser(user.id);
  if (memberships.length > 0 && params.new !== "1") redirect("/dashboard");

  // Esta tela vive fora de (app), então traz o seu próprio provider: o formulário usa
  // componentes compartilhados (o SubmitButton, por exemplo) que leem o dicionário do contexto.
  const dict = await getAppDictionary(await appLocale());

  // Nomear o provedor é o que torna o último passo compreensível: "provedor de pagamentos"
  // não diz a ninguém onde os documentos vão parar.
  const providerName = services.paymentProvider.type === "MOCK" ? dict.onboarding.mockProvider : "Stripe";

  return (
    <AppDictionaryProvider dict={dict}>
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-4">
        <KabrunLogo />
        <OnboardingForm
          defaultEmail={user.email}
          providerName={providerName}
          countries={localizedCountries(dict.localeTag)}
        />
        <p className="text-xs text-muted-foreground">{dict.onboarding.footnote}</p>
      </div>
    </AppDictionaryProvider>
  );
}
