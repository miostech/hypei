import { LockIcon, MailIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { trackingSchema } from "@/modules/checkout/checkout.schemas";
import { getServices } from "@/server/container";
import { formatAmount } from "@/lib/ui/format";
import { RipayLogo } from "@/components/brand/logo";
import { CheckoutClient } from "./checkout-client";
import { CouponProvider, OrderTotals } from "./coupon-context";

export async function generateMetadata({
  params,
}: PageProps<"/checkout/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const checkout = await getServices().checkouts.getPublic(slug);
  return {
    title: checkout ? `${checkout.product.name} — Checkout` : "Checkout",
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

  const accent = checkout.config.theme.accentColor;
  const price = formatAmount(checkout.offer.amount, checkout.offer.currency);

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <div
        aria-hidden
        className="h-1.5 w-full"
        style={{ background: accent }}
      />

      <CouponProvider>
        <main className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-8 lg:grid-cols-[1fr_360px] lg:py-14">
          <section className="space-y-6">
            <header className="space-y-3">
              {checkout.config.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- producer-provided external logo
                <img
                  src={checkout.config.logoUrl}
                  alt={checkout.organization.name}
                  className="h-11 w-auto"
                />
              )}
              <h1 className="font-heading text-3xl font-bold tracking-tight text-balance">
                {checkout.config.headline}
              </h1>
              {checkout.config.description && (
                <p className="text-pretty text-muted-foreground">
                  {checkout.config.description}
                </p>
              )}
            </header>

            <CheckoutClient
              slug={slug}
              organizationId={checkout.organization.id}
              checkoutId={checkout.checkoutId}
              collectPhone={checkout.config.fields.phone}
              collectCountry={checkout.config.fields.country}
              paymentMethods={checkout.paymentMethods}
              provider={checkout.provider}
              publishableKey={
                process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null
              }
              accentColor={accent}
              tracking={tracking}
              amountLabel={price}
            />
          </section>

          <aside className="space-y-4 lg:sticky lg:top-8 lg:h-fit">
            <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
              <p className="border-b px-5 py-3 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Resumo do pedido
              </p>
              <div className="space-y-4 p-5">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ background: accent }}
                  >
                    {checkout.product.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{checkout.product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {checkout.offer.name}
                    </p>
                  </div>
                </div>

                <OrderTotals subtotalLabel={price} />
              </div>
            </div>

            <div className="space-y-2.5 rounded-2xl border bg-card p-5 text-sm text-muted-foreground shadow-soft">
              <p className="flex items-center gap-2">
                <LockIcon className="size-4 text-success" aria-hidden />{" "}
                Pagamento processado com segurança
              </p>
              {checkout.config.guaranteeDays > 0 && (
                <p className="flex items-center gap-2">
                  <ShieldCheckIcon
                    className="size-4 text-success"
                    aria-hidden
                  />{" "}
                  Garantia de {checkout.config.guaranteeDays} dias
                </p>
              )}
              <p className="flex items-center gap-2">
                <MailIcon className="size-4 text-success" aria-hidden /> Acesso
                enviado por e-mail
              </p>
            </div>

            <p className="px-1 text-xs text-muted-foreground">
              Vendido por{" "}
              <strong className="font-medium text-foreground">
                {checkout.organization.name}
              </strong>
              {checkout.organization.supportEmail
                ? ` · ${checkout.organization.supportEmail}`
                : ""}
            </p>
          </aside>
        </main>
      </CouponProvider>

      <footer className="border-t bg-card/60 py-5">
        <p className="mx-auto flex w-full max-w-5xl items-center justify-center gap-1.5 px-4 text-xs text-muted-foreground">
          Pagamento processado por
          <RipayLogo className="h-4" />
        </p>
      </footer>
    </div>
  );
}
