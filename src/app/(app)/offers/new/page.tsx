import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { createOffer } from "../actions";
import { OfferForm } from "../offer-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAppDictionary(await appLocale());
  return { title: dict.offerForm.newTitle };
}

export default async function NewOfferPage({ searchParams }: PageProps<"/offers/new">) {
  const { organization } = await requirePagePermission("products:write");
  const params = await searchParams;
  const services = getServices();
  const [products, merchant] = await Promise.all([
    services.products.list(organization.id),
    services.merchantAccounts.getForOrganization(organization.id),
  ]);
  if (products.length === 0) redirect("/products/new");

  const t = (await getAppDictionary(await appLocale())).offerForm;
  const productId = typeof params.productId === "string" && products.some((p) => p.id === params.productId) ? params.productId : products[0].id;

  return (
    <>
      <PageHeader title={t.newTitle} description={t.newDescription} />
      <OfferForm
        action={createOffer}
        products={products.map((p) => ({ id: p.id, name: p.name }))}
        submitLabel={t.createSubmit}
        settlesIn={merchant?.defaultCurrency ?? null}
        defaultValues={{ productId, name: "", price: "", currency: organization.defaultCurrency, billingType: "ONE_TIME", active: true }}
      />
    </>
  );
}
