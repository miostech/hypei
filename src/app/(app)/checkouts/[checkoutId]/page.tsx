import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeliveryWarning } from "@/components/shared/delivery-warning";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";
import { NotFoundError } from "@/lib/errors";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill } from "@/lib/i18n/locale";
import { formatAmount } from "@/lib/ui/format";
import { GUARANTEE_MIN_DAYS } from "@/modules/checkout/checkout.schemas";
import { resolvePaymentMethods } from "@/modules/payments/payment-method-resolver";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { updateCheckout } from "../actions";
import { CheckoutForm } from "../checkout-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAppDictionary(await appLocale());
  return { title: dict.checkouts.title };
}

export default async function CheckoutDetailPage({ params }: PageProps<"/checkouts/[checkoutId]">) {
  const { checkoutId } = await params;
  const { organization } = await requirePagePermission("products:read");
  const services = getServices();

  const { checkout, config } = await services.checkouts.getForEdit(organization.id, checkoutId).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const delivery = await services.products.delivery(organization.id, checkout.offer.productId);
  const [bannerUrl, logoUrl] = await Promise.all([
    services.checkouts.assetUrl(config?.bannerKey ?? null),
    services.checkouts.assetUrl(config?.logoKey ?? null),
  ]);

  const dict = await getAppDictionary(await appLocale());
  const t = dict.checkoutForm;
  const availableMethods = resolvePaymentMethods({
    provider: services.paymentProvider.type,
    currency: checkout.offer.currency,
    merchantCountry: organization.country,
  });

  return (
    <>
      <PageHeader
        title={checkout.name}
        description={fill(t.editDescription, {
          version: checkout.currentVersion,
          price: formatAmount(checkout.offer.amount, checkout.offer.currency),
        })}
        actions={
          <Button variant="outline" render={<Link href={`/checkout/${checkout.slug}`} target="_blank" />}>
            <ExternalLinkIcon />
            {dict.checkouts.open}
          </Button>
        }
      />
      <DeliveryWarning delivery={delivery} productId={checkout.offer.productId} dict={dict} />

      <CheckoutForm
        action={updateCheckout}
        offers={[{ id: checkout.offerId, label: `${checkout.offer.product.name} — ${checkout.offer.name}` }]}
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
        }}
      />
    </>
  );
}
