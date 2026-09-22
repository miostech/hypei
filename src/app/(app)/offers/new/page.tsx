import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { createOffer } from "../actions";
import { OfferForm } from "../offer-form";

export const metadata = { title: "Nova oferta" };

export default async function NewOfferPage({ searchParams }: PageProps<"/offers/new">) {
  const { organization } = await requirePagePermission("products:write");
  const params = await searchParams;
  const products = await getServices().products.list(organization.id);
  if (products.length === 0) redirect("/products/new");

  const productId = typeof params.productId === "string" && products.some((p) => p.id === params.productId) ? params.productId : products[0].id;

  return (
    <>
      <PageHeader title="Nova oferta" description="Defina preço, moeda e forma de cobrança." />
      <OfferForm
        action={createOffer}
        products={products.map((p) => ({ id: p.id, name: p.name }))}
        submitLabel="Criar oferta"
        defaultValues={{ productId, name: "", price: "", currency: organization.defaultCurrency, billingType: "ONE_TIME", active: true }}
      />
    </>
  );
}
