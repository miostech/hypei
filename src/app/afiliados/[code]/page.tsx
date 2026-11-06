import { ArrowRightIcon, LogInIcon, UserPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { KabrunLogo } from "@/components/brand/logo";
import { CopyLink } from "@/app/(app)/affiliates/copy-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEnv } from "@/lib/env";
import { getAppDictionary } from "@/lib/i18n/app";
import { AppDictionaryProvider } from "@/lib/i18n/app/provider";
import { appLocale } from "@/lib/i18n/app/server";
import { fill } from "@/lib/i18n/locale";
import { normalizeReferralCode } from "@/modules/affiliates/referral";
import { getCurrentUser } from "@/modules/auth/current-user";
import { getServices } from "@/server/container";
import { AcceptAffiliation } from "./accept-affiliation";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).invite.title };
}

/**
 * O convite de afiliação, aberto a quem receber o link.
 *
 * Mostra o produto e a comissão antes de pedir login: quem está decidindo se vale a pena
 * precisa ver a oferta primeiro, e não existe nada de sigiloso nela — o produtor distribui
 * este link justamente para ser lido.
 */
export default async function InvitePage({ params }: PageProps<"/afiliados/[code]">) {
  const { code: raw } = await params;
  const code = normalizeReferralCode(raw);
  const services = getServices();
  const dict = await getAppDictionary(await appLocale());
  const t = dict.invite;

  const [product, user] = await Promise.all([services.affiliates.invitation(code), getCurrentUser()]);

  const [affiliation, memberships] = await Promise.all([
    user && product
      ? services.affiliates.listForUser(user.id).then((list) => list.find((item) => item.productId === product.id) ?? null)
      : null,
    user ? services.organizations.listForUser(user.id) : [],
  ]);

  const inviteHref = `/afiliados/${code}`;
  // Se o produto é da própria pessoa, o convite não vale para ela: melhor dizer isso agora do
  // que oferecer um botão que só pode dar erro.
  const ownProduct = Boolean(product) && memberships.some((m) => m.organization.id === product?.organizationId);

  return (
    <AppDictionaryProvider dict={dict}>
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-4">
        <KabrunLogo />

        <Card className="w-full max-w-md">
          {!product ? (
            <>
              <CardHeader>
                <CardTitle>{t.notFound}</CardTitle>
                <CardDescription>{t.notFoundBody}</CardDescription>
              </CardHeader>
            </>
          ) : (
            <>
              <CardHeader className="space-y-2">
                <Badge variant="success" className="w-fit">
                  {fill(t.commission, { percent: (product.affiliateCommissionBps ?? 0) / 100 })}
                </Badge>
                <CardTitle>{fill(t.heading, { product: product.name })}</CardTitle>
                <CardDescription>{fill(t.by, { producer: product.organization.name })}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {affiliation ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{t.accepted}</p>
                    <p className="text-sm text-muted-foreground">{t.acceptedBody}</p>
                    <CopyLink url={`${getEnv().APP_URL}/r/${affiliation.code}`} label={product.name} />
                    <Button variant="outline" className="w-full" render={<Link href="/affiliations" />}>
                      {t.goToArea}
                      <ArrowRightIcon />
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">{ownProduct ? t.ownProduct : t.terms}</p>
                    {ownProduct ? null : !user ? (
                      <Button
                        className="w-full"
                        render={<Link href={`/api/auth/login?returnTo=${encodeURIComponent(inviteHref)}`} />}
                      >
                        <LogInIcon />
                        {t.signIn}
                      </Button>
                    ) : memberships.length === 0 ? (
                      <>
                        {/* Sem conta não há para onde mandar a comissão: país, moeda e
                            identificação fiscal de quem recebe moram na organização. */}
                        <Button className="w-full" render={<Link href={`/onboarding?returnTo=${encodeURIComponent(inviteHref)}`} />}>
                          <UserPlusIcon />
                          {t.createAccount}
                        </Button>
                        <p className="text-xs text-muted-foreground">{t.needsAccount}</p>
                      </>
                    ) : (
                      <AcceptAffiliation code={code} />
                    )}
                  </>
                )}
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-xs text-muted-foreground">{t.footnote}</p>
      </div>
    </AppDictionaryProvider>
  );
}
