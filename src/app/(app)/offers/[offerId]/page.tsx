import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import type { Metadata } from "next";
import { NotFoundError } from "@/lib/errors";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill } from "@/lib/i18n/locale";
import { convertMinorUnits, assertSupportedCurrency } from "@/lib/money";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { updateOffer } from "../actions";
import { OfferForm } from "../offer-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAppDictionary(await appLocale());
  return { title: dict.offers.title };
}

export default async function OfferPage({ params }: PageProps<"/offers/[offerId]">) {
  const { offerId } = await params;
  const { organization } = await requirePagePermission("products:read");
  const services = getServices();

  const offer = await services.offers.get(organization.id, offerId).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const [products, merchant] = await Promise.all([
    services.products.list(organization.id),
    services.merchantAccounts.getForOrganization(organization.id),
  ]);
  const dict = await getAppDictionary(await appLocale());

  return (
    <>
      <PageHeader title={offer.name} description={fill(dict.offerForm.editDescription, { product: offer.product.name })} />
      <OfferForm
        action={updateOffer}
        products={products.map((p) => ({ id: p.id, name: p.name }))}
        submitLabel={dict.common.saveChanges}
        settlesIn={merchant?.defaultCurrency ?? null}
        defaultValues={{
          id: offer.id,
          productId: offer.productId,
          name: offer.name,
          price: convertMinorUnits(offer.amount, assertSupportedCurrency(offer.currency)),
          currency: offer.currency,
          billingType: offer.billingType,
          installments: offer.installments ?? undefined,
          billingInterval: offer.billingInterval ?? undefined,
          trialDays: offer.trialDays ?? undefined,
          active: offer.active,
        }}
      />
    </>
  );
}
