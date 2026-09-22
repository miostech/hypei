import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { NotFoundError } from "@/lib/errors";
import { formatAmount } from "@/lib/ui/format";
import { resolvePaymentMethods } from "@/modules/payments/payment-method-resolver";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { updateCheckout } from "../actions";
import { CheckoutForm } from "../checkout-form";

export const metadata = { title: "Editar checkout" };

export default async function CheckoutDetailPage({ params }: PageProps<"/checkouts/[checkoutId]">) {
  const { checkoutId } = await params;
  const { organization } = await requirePagePermission("products:read");
  const services = getServices();

  const { checkout, config } = await services.checkouts.getForEdit(organization.id, checkoutId).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

  const availableMethods = resolvePaymentMethods({
    provider: services.paymentProvider.type,
    currency: checkout.offer.currency,
    merchantCountry: organization.country,
  });

  return (
    <>
      <PageHeader
        title={checkout.name}
        description={`Versão atual: v${checkout.currentVersion} · ${formatAmount(checkout.offer.amount, checkout.offer.currency)}`}
        actions={
          <Button variant="outline" render={<Link href={`/checkout/${checkout.slug}`} target="_blank" />}>
            <ExternalLinkIcon />
            Abrir checkout
          </Button>
        }
      />
      <CheckoutForm
        action={updateCheckout}
        offers={[{ id: checkout.offerId, label: `${checkout.offer.product.name} — ${checkout.offer.name}` }]}
        availableMethods={availableMethods}
        submitLabel="Salvar nova versão"
        lockedOffer
        defaultValues={{
          id: checkout.id,
          offerId: checkout.offerId,
          name: checkout.name,
          slug: checkout.slug,
          headline: config?.headline ?? checkout.offer.product.name,
          description: config?.description ?? "",
          accentColor: config?.theme.accentColor ?? "#5B3DF5",
          logoUrl: config?.logoUrl ?? "",
          collectPhone: config?.fields.phone ?? false,
          guaranteeDays: config?.guaranteeDays ?? 7,
          enabledPaymentMethods: config?.enabledPaymentMethods ?? [],
        }}
      />
    </>
  );
}
