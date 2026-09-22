import { ArchiveIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotFoundError } from "@/lib/errors";
import { formatAmount } from "@/lib/ui/format";
import { BILLING_TYPE_LABELS } from "@/modules/offers/offer.schemas";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { archiveProduct, updateProduct } from "../actions";
import { ProductForm } from "../product-form";

export const metadata = { title: "Editar produto" };

export default async function ProductPage({ params }: PageProps<"/products/[productId]">) {
  const { productId } = await params;
  const { organization } = await requirePagePermission("products:read");
  const services = getServices();

  const product = await services.products.get(organization.id, productId).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const offers = (await services.offers.list(organization.id)).filter((offer) => offer.productId === product.id);

  return (
    <>
      <PageHeader
        title={product.name}
        description="Edite as informações do produto e gerencie suas ofertas."
        actions={
          <form action={archiveProduct}>
            <input type="hidden" name="id" value={product.id} />
            <Button type="submit" variant="outline" disabled={product.status === "ARCHIVED"}>
              <ArchiveIcon />
              Arquivar
            </Button>
          </form>
        }
      />

      <ProductForm
        action={updateProduct}
        submitLabel="Salvar alterações"
        defaultValues={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description ?? "",
          type: product.type,
          status: product.status,
          thumbnailUrl: product.thumbnailUrl ?? "",
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Ofertas</CardTitle>
          <CardDescription>Cada oferta é um preço e uma forma de cobrança deste produto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {offers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma oferta criada para este produto.</p>
          ) : (
            offers.map((offer) => (
              <div key={offer.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <Link href={`/offers/${offer.id}`} className="text-sm font-medium hover:underline">
                    {offer.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{BILLING_TYPE_LABELS[offer.billingType]}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular text-sm font-medium">{formatAmount(offer.amount, offer.currency)}</span>
                  <Badge variant={offer.active ? "success" : "secondary"}>{offer.active ? "Ativa" : "Inativa"}</Badge>
                </div>
              </div>
            ))
          )}
          <Button variant="outline" size="sm" render={<Link href={`/offers/new?productId=${product.id}`} />}>
            <PlusIcon />
            Nova oferta
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
