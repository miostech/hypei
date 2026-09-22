import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { NotFoundError } from "@/lib/errors";
import { convertMinorUnits, assertSupportedCurrency } from "@/lib/money";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { updateOffer } from "../actions";
import { OfferForm } from "../offer-form";

export const metadata = { title: "Editar oferta" };

export default async function OfferPage({ params }: PageProps<"/offers/[offerId]">) {
  const { offerId } = await params;
  const { organization } = await requirePagePermission("products:read");
  const services = getServices();

  const offer = await services.offers.get(organization.id, offerId).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const products = await services.products.list(organization.id);

  return (
    <>
      <PageHeader title={offer.name} description={`Oferta de ${offer.product.name}`} />
      <OfferForm
        action={updateOffer}
        products={products.map((p) => ({ id: p.id, name: p.name }))}
        submitLabel="Salvar alterações"
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
