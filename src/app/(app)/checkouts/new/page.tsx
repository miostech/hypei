import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill } from "@/lib/i18n/locale";
import { formatAmount } from "@/lib/ui/format";
import { GUARANTEE_MIN_DAYS } from "@/modules/checkout/checkout.schemas";
import { resolvePaymentMethods } from "@/modules/payments/payment-method-resolver";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { createCheckout } from "../actions";
import { CheckoutForm } from "../checkout-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAppDictionary(await appLocale());
  return { title: dict.checkoutForm.newTitle };
}

export default async function NewCheckoutPage({ searchParams }: PageProps<"/checkouts/new">) {
  const { organization } = await requirePagePermission("checkout:write");
  const services = getServices();
  const params = await searchParams;
  const offers = (await services.offers.list(organization.id)).filter((offer) => offer.active);
  if (offers.length === 0) redirect("/offers/new");

  // Quem chega pela aba de links de um produto já disse qual produto é; o seletor continua aí,
  // só não começa em outro produto qualquer.
  const selected =
    (typeof params.productId === "string" ? offers.find((offer) => offer.productId === params.productId) : undefined) ?? offers[0];
  const bumpOffers = await services.checkouts.bumpCandidates(organization.id, selected.id);

  const t = (await getAppDictionary(await appLocale())).checkoutForm;
  const availableMethods = resolvePaymentMethods({
    provider: services.paymentProvider.type,
    currency: organization.defaultCurrency,
    merchantCountry: organization.country,
  });

  return (
    <>
      <PageHeader title={t.newTitle} description={t.newDescription} />
      <CheckoutForm
        action={createCheckout}
        offers={offers.map((o) => ({ id: o.id, label: `${o.product.name} — ${o.name} (${formatAmount(o.amount, o.currency)})` }))}
        bumpOffers={bumpOffers.map((o) => ({ id: o.id, label: `${o.product.name} — ${o.name} (${formatAmount(o.amount, o.currency)})` }))}
        availableMethods={availableMethods}
        submitLabel={t.createSubmit}
        defaultValues={{
          offerId: selected.id,
          name: selected.product.name,
          slug: selected.product.slug,
          headline: fill(t.headlineDefault, { product: selected.product.name }),
          description: "",
          accentColor: "#5B3DF5",
          logoKey: "",
          logoUrl: null,
          bannerKey: "",
          bannerUrl: null,
          collectPhone: false,
          guaranteeDays: GUARANTEE_MIN_DAYS,
          enabledPaymentMethods: [],
          orderBumps: [],
        }}
      />
    </>
  );
}
