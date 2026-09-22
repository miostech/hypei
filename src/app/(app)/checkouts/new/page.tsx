import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { formatAmount } from "@/lib/ui/format";
import { resolvePaymentMethods } from "@/modules/payments/payment-method-resolver";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { createCheckout } from "../actions";
import { CheckoutForm } from "../checkout-form";

export const metadata = { title: "Novo checkout" };

export default async function NewCheckoutPage() {
  const { organization } = await requirePagePermission("checkout:write");
  const services = getServices();
  const offers = (await services.offers.list(organization.id)).filter((offer) => offer.active);
  if (offers.length === 0) redirect("/offers/new");

  const availableMethods = resolvePaymentMethods({
    provider: services.paymentProvider.type,
    currency: organization.defaultCurrency,
    merchantCountry: organization.country,
  });

  return (
    <>
      <PageHeader title="Novo checkout" description="Monte a página de pagamento da sua oferta." />
      <CheckoutForm
        action={createCheckout}
        offers={offers.map((o) => ({ id: o.id, label: `${o.product.name} — ${o.name} (${formatAmount(o.amount, o.currency)})` }))}
        availableMethods={availableMethods}
        submitLabel="Criar checkout"
        defaultValues={{
          offerId: offers[0].id,
          name: offers[0].product.name,
          slug: offers[0].product.slug,
          headline: `Garanta seu acesso a ${offers[0].product.name}`,
          description: "",
          accentColor: "#5B3DF5",
          logoUrl: "",
          collectPhone: false,
          guaranteeDays: 7,
          enabledPaymentMethods: [],
        }}
      />
    </>
  );
}
