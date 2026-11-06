import { ClockIcon, LockIcon, MailIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { trackingSchema } from "@/modules/checkout/checkout.schemas";
import { getServices } from "@/server/container";
import { getCheckoutDictionary } from "@/lib/i18n/checkout";
import { localizedCountries } from "@/lib/i18n/countries";
import { fill } from "@/lib/i18n/locale";
import { fillNode } from "@/lib/i18n/fill-node";
import { langParam, requestLocale } from "@/lib/i18n/server";
import { KabrunLogo } from "@/components/brand/logo";
import { CheckoutClient } from "./checkout-client";
import { CheckoutStateProvider, OrderTotals, type BumpOption } from "./checkout-state";
import { OrderBumps } from "./order-bump";
import { SafeImage } from "./safe-image";

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/checkout/[slug]">): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const dict = await getCheckoutDictionary(await requestLocale(langParam(query)));
  const checkout = await getServices().checkouts.getPublic(slug);
  return {
    title: checkout
      ? fill(dict.page.title, { product: checkout.product.name })
      : dict.page.titleFallback,
  };
}

export default async function PublicCheckoutPage({
  params,
  searchParams,
}: PageProps<"/checkout/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const checkout = await getServices().checkouts.getPublic(slug);
  if (!checkout) notFound();

  const pick = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : null;
  const tracking = trackingSchema.parse({
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    utm_content: pick("utm_content"),
    utm_term: pick("utm_term"),
    affiliateId: pick("aff") ?? pick("affiliateId"),
  });

  // Quem compra escolhe o idioma, não quem vende: é o navegador do comprador que diz qual é.
  const locale = await requestLocale(pick("lang"));
  const dict = await getCheckoutDictionary(locale);

  const accent = checkout.config.theme.accentColor;
  // `bigint` não atravessa o limite servidor → cliente como prop; vira string de centavos aqui
  // e `bigint` de novo na primeira conta, do outro lado.
  const bumps: BumpOption[] = checkout.orderBumps.map((bump) => ({
    offerId: bump.offerId,
    productName: bump.productName,
    headline: bump.headline,
    description: bump.description,
    amount: String(bump.amount),
    compareAtAmount: bump.compareAtAmount === null ? null : String(bump.compareAtAmount),
  }));
  // Assinadas a cada renderização: a página é dinâmica, então a URL nunca chega vencida ao
  // comprador, e os objetos continuam privados no bucket como o resto da mídia.
  const [bannerUrl, logoUrl, thumbnailUrl] = await Promise.all([
    getServices().checkouts.assetUrl(checkout.config.bannerKey),
    getServices().checkouts.assetUrl(checkout.config.logoKey),
    getServices().checkouts.assetUrl(checkout.product.thumbnailKey),
  ]);

  return (
    // O <html lang> do layout raiz é pt-BR e vale para o app todo; aqui o lang do idioma do
    // comprador desce na subárvore, que é o que leitor de tela e tradutor automático olham.
    <div lang={dict.localeTag} className="flex min-h-svh flex-col bg-muted/40">
      <div
        aria-hidden
        className="h-1.5 w-full"
        style={{ background: accent }}
      />

      <CheckoutStateProvider offerAmount={String(checkout.offer.amount)} currency={checkout.offer.currency} bumps={bumps}>
        <main className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-8 lg:grid-cols-[1fr_360px] lg:py-14">
          <section className="space-y-6">
            <SafeImage
              src={bannerUrl}
              alt=""
              className="aspect-[16/5] w-full rounded-xl border object-cover shadow-soft"
            />

            <header className="space-y-3">
              <SafeImage src={logoUrl} alt={checkout.organization.name} className="h-11 w-auto" />
              <h1 className="font-heading text-3xl font-bold tracking-tight text-balance">
                {checkout.config.headline}
              </h1>
              {checkout.config.description && (
                <p className="text-pretty text-muted-foreground">
                  {checkout.config.description}
                </p>
              )}
            </header>

            {checkout.acceptsPayments && <OrderBumps dict={dict} accentColor={accent} />}

            {checkout.acceptsPayments ? (
              <CheckoutClient
                slug={slug}
                organizationId={checkout.organization.id}
                checkoutId={checkout.checkoutId}
                collectPhone={checkout.config.fields.phone}
                countries={
                  checkout.config.fields.country ? localizedCountries(dict.localeTag) : null
                }
                paymentMethods={checkout.paymentMethods}
                provider={checkout.provider}
                publishableKey={
                  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null
                }
                accentColor={accent}
                tracking={tracking}
                locale={locale}
                dict={dict}
              />
            ) : (
              /* O serviço recusa esta venda de qualquer jeito. Esconder o formulário é o que
                 evita o comprador digitar o cartão para só então levar erro. */
              <div className="space-y-2 rounded-xl border border-dashed bg-card p-8 text-center">
                <ClockIcon
                  className="mx-auto size-8 text-muted-foreground"
                  aria-hidden
                />
                <p className="font-medium">{dict.notLive.title}</p>
                <p className="text-pretty text-sm text-muted-foreground">
                  {fill(dict.notLive.body, { seller: checkout.organization.name })}
                  {checkout.organization.supportEmail
                    ? ` ${fill(dict.notLive.support, { email: checkout.organization.supportEmail })}`
                    : ""}
                </p>
              </div>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-8 lg:h-fit">
            <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
              <p className="border-b px-5 py-3 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                {dict.summary.title}
              </p>
              <div className="space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <SafeImage
                    src={thumbnailUrl}
                    alt=""
                    className="size-12 shrink-0 rounded-xl border object-cover"
                    fallback={
                      <span
                        aria-hidden
                        className="flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                        style={{ background: accent }}
                      >
                        {checkout.product.name.slice(0, 2).toUpperCase()}
                      </span>
                    }
                  />
                  <div className="min-w-0">
                    <p className="font-medium">{checkout.product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {checkout.offer.name}
                    </p>
                  </div>
                </div>

                <OrderTotals dict={dict} />
              </div>
            </div>

            <div className="space-y-2.5 rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-soft">
              <p className="flex items-center gap-2">
                <LockIcon className="size-4 text-success" aria-hidden />{" "}
                {dict.trust.secure}
              </p>
              {checkout.config.guaranteeDays > 0 && (
                <p className="flex items-center gap-2">
                  <ShieldCheckIcon
                    className="size-4 text-success"
                    aria-hidden
                  />{" "}
                  {fill(dict.trust.guarantee, { days: checkout.config.guaranteeDays })}
                </p>
              )}
              <p className="flex items-center gap-2">
                <MailIcon className="size-4 text-success" aria-hidden />{" "}
                {dict.trust.emailAccess}
              </p>
            </div>

            <p className="px-1 text-xs text-muted-foreground">
              {fillNode(
                dict.soldBy,
                "seller",
                <strong className="font-medium text-foreground">
                  {checkout.organization.name}
                </strong>,
              )}
              {checkout.organization.supportEmail
                ? ` · ${checkout.organization.supportEmail}`
                : ""}
            </p>
          </aside>
        </main>
      </CheckoutStateProvider>

      <footer className="border-t bg-card/60 py-5">
        <p className="mx-auto flex w-full max-w-5xl items-center justify-center gap-1.5 px-4 text-xs text-muted-foreground">
          {fillNode(dict.processedBy, "brand", <KabrunLogo className="h-4" />)}
        </p>
      </footer>
    </div>
  );
}
