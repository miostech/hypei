import { LockIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { trackingSchema } from "@/modules/checkout/checkout.schemas";
import { getServices } from "@/server/container";
import { formatAmount } from "@/lib/ui/format";
import { CheckoutClient } from "./checkout-client";

export async function generateMetadata({ params }: PageProps<"/checkout/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const checkout = await getServices().checkouts.getPublic(slug);
  return { title: checkout ? `${checkout.product.name} — Checkout` : "Checkout" };
}

export default async function PublicCheckoutPage({ params, searchParams }: PageProps<"/checkout/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const checkout = await getServices().checkouts.getPublic(slug);
  if (!checkout) notFound();

  const pick = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : null);
  const tracking = trackingSchema.parse({
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    utm_content: pick("utm_content"),
    utm_term: pick("utm_term"),
    affiliateId: pick("aff") ?? pick("affiliateId"),
  });

  const accent = checkout.config.theme.accentColor;

  return (
    <div className="flex min-h-svh flex-col bg-muted/30" style={{ ["--brand" as string]: accent }}>
      <div aria-hidden className="h-1 w-full" style={{ background: accent }} />
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-8 lg:grid-cols-[1fr_380px] lg:py-12">
        <section className="space-y-6">
          <header className="space-y-2">
            {checkout.config.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- producer-provided external logo
              <img src={checkout.config.logoUrl} alt={checkout.organization.name} className="h-10 w-auto" />
            )}
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{checkout.config.headline}</h1>
            {checkout.config.description && <p className="text-pretty text-muted-foreground">{checkout.config.description}</p>}
          </header>

          <CheckoutClient
            slug={slug}
            organizationId={checkout.organization.id}
            checkoutId={checkout.checkoutId}
            collectPhone={checkout.config.fields.phone}
            collectCountry={checkout.config.fields.country}
            paymentMethods={checkout.paymentMethods}
            provider={checkout.provider}
            publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null}
            accentColor={accent}
            tracking={tracking}
            amountLabel={formatAmount(checkout.offer.amount, checkout.offer.currency)}
          />
        </section>

        <aside className="space-y-4 lg:sticky lg:top-8 lg:h-fit">
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-medium text-muted-foreground">Resumo</h2>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{checkout.product.name}</p>
                <p className="text-sm text-muted-foreground">{checkout.offer.name}</p>
              </div>
              <p className="tabular font-semibold">{formatAmount(checkout.offer.amount, checkout.offer.currency)}</p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <span className="text-sm font-medium">Total</span>
              <span className="tabular text-lg font-semibold">{formatAmount(checkout.offer.amount, checkout.offer.currency)}</span>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <LockIcon className="size-4" /> Pagamento processado com segurança
            </p>
            {checkout.config.guaranteeDays > 0 && (
              <p className="flex items-center gap-2">
                <ShieldCheckIcon className="size-4" /> Garantia de {checkout.config.guaranteeDays} dias
              </p>
            )}
            <p className="pt-2 text-xs">
              Vendido por {checkout.organization.name}
              {checkout.organization.supportEmail ? ` · ${checkout.organization.supportEmail}` : ""}
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
