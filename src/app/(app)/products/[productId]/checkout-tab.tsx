import { CreditCardIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { updateCheckout } from "@/app/(app)/checkouts/actions";
import { CheckoutForm } from "@/app/(app)/checkouts/checkout-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import type { AppDictionary } from "@/lib/i18n/app";
import { assertSupportedCurrency, convertMinorUnits } from "@/lib/money";
import { formatAmount } from "@/lib/ui/format";
import type { CheckoutWithOffer } from "@/modules/checkout/checkout.repository";
import { GUARANTEE_MIN_DAYS } from "@/modules/checkout/checkout.schemas";
import { resolvePaymentMethods } from "@/modules/payments/payment-method-resolver";
import { getServices } from "@/server/container";

/**
 * A página de pagamento do produto, editada sem sair dele.
 *
 * Um produto pode ter mais de um checkout — modelo antigo, link de campanha —, e esta aba edita
 * um por vez: quem escolhe qual é a URL, e a lista completa fica na aba de links.
 */
export async function ProductCheckoutTab({
  organization,
  productId,
  checkouts,
  hasActiveOffer,
  selectedId,
  dict,
}: {
  organization: { id: string; country: string };
  productId: string;
  checkouts: CheckoutWithOffer[];
  hasActiveOffer: boolean;
  selectedId: string | undefined;
  dict: AppDictionary;
}) {
  const t = dict.checkoutForm;

  if (!hasActiveOffer) {
    return (
      <EmptyState
        icon={CreditCardIcon}
        title={dict.checkouts.needOfferTitle}
        description={dict.checkouts.needOfferBody}
        action={
          <Button render={<Link href={`/products/${productId}?aba=geral`} />}>{dict.productForm.offers.new}</Button>
        }
      />
    );
  }

  const selected = checkouts.find((checkout) => checkout.id === selectedId) ?? checkouts[0];
  if (!selected) {
    return (
      <EmptyState
        icon={CreditCardIcon}
        title={dict.checkouts.emptyTitle}
        description={dict.checkouts.emptyBody}
        action={<Button render={<Link href={`/checkouts/new?productId=${productId}`} />}>{dict.checkouts.create}</Button>}
      />
    );
  }

  const services = getServices();
  const { checkout, config } = await services.checkouts.getForEdit(organization.id, selected.id);
  const [bannerUrl, logoUrl, bumpOffers] = await Promise.all([
    services.checkouts.assetUrl(config?.bannerKey ?? null),
    services.checkouts.assetUrl(config?.logoKey ?? null),
    services.checkouts.bumpCandidates(organization.id, checkout.offerId),
  ]);

  const currency = assertSupportedCurrency(checkout.offer.currency);
  const availableMethods = resolvePaymentMethods({
    provider: services.paymentProvider.type,
    currency: checkout.offer.currency,
    merchantCountry: organization.country,
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {checkouts.length > 1 ? (
          <nav className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-muted p-1">
            {checkouts.map((option) => (
              <Button
                key={option.id}
                size="sm"
                variant={option.id === checkout.id ? "default" : "ghost"}
                className="h-7 shrink-0 rounded-lg px-2.5"
                render={<Link href={`/products/${productId}?aba=checkout&checkout=${option.id}`} />}
              >
                {option.name}
              </Button>
            ))}
          </nav>
        ) : (
          <span />
        )}
        <Button variant="outline" size="sm" render={<Link href={`/checkout/${checkout.slug}`} target="_blank" />}>
          <ExternalLinkIcon />
          {dict.checkouts.open}
        </Button>
      </div>

      <CheckoutForm
        action={updateCheckout}
        offers={[{ id: checkout.offerId, label: `${checkout.offer.product.name} — ${checkout.offer.name}` }]}
        bumpOffers={bumpOffers.map((o) => ({ id: o.id, label: `${o.product.name} — ${o.name} (${formatAmount(o.amount, o.currency)})` }))}
        availableMethods={availableMethods}
        submitLabel={t.saveSubmit}
        lockedOffer
        defaultValues={{
          id: checkout.id,
          offerId: checkout.offerId,
          name: checkout.name,
          slug: checkout.slug,
          headline: config?.headline ?? checkout.offer.product.name,
          description: config?.description ?? "",
          accentColor: config?.theme.accentColor ?? "#5B3DF5",
          logoKey: config?.logoKey ?? "",
          logoUrl,
          bannerKey: config?.bannerKey ?? "",
          bannerUrl,
          collectPhone: config?.fields.phone ?? false,
          guaranteeDays: config?.guaranteeDays ?? GUARANTEE_MIN_DAYS,
          enabledPaymentMethods: config?.enabledPaymentMethods ?? [],
          // O config guarda centavos; o formulário mostra o que uma pessoa digita.
          orderBumps: (config?.orderBumps ?? []).map((bump) => ({
            offerId: bump.offerId,
            headline: bump.headline,
            description: bump.description,
            price: convertMinorUnits(BigInt(bump.amount), currency),
            compareAtPrice: bump.compareAtAmount === null ? "" : convertMinorUnits(BigInt(bump.compareAtAmount), currency),
          })),
        }}
      />
    </>
  );
}
