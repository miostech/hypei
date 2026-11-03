import { ArchiveIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeliveryWarning } from "@/components/shared/delivery-warning";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";
import { NotFoundError } from "@/lib/errors";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { formatAmount } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { archiveProduct, updateProduct } from "../actions";
import { ProductForm } from "../product-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAppDictionary(await appLocale());
  return { title: dict.products.title };
}

export default async function ProductPage({ params }: PageProps<"/products/[productId]">) {
  const { productId } = await params;
  const { organization } = await requirePagePermission("products:read");
  const services = getServices();

  const product = await services.products.get(organization.id, productId).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const [allOffers, delivery, thumbnailUrl] = await Promise.all([
    services.offers.list(organization.id),
    services.products.delivery(organization.id, product.id),
    services.products.thumbnailUrl(product.thumbnailKey),
  ]);
  const offers = allOffers.filter((offer) => offer.productId === product.id);
  const dict = await getAppDictionary(await appLocale());
  const t = dict.productForm;

  return (
    <>
      <PageHeader
        title={product.name}
        description={t.editDescription}
        actions={
          <form action={archiveProduct}>
            <input type="hidden" name="id" value={product.id} />
            <Button type="submit" variant="outline" disabled={product.status === "ARCHIVED"}>
              <ArchiveIcon />
              {t.archive}
            </Button>
          </form>
        }
      />

      <DeliveryWarning delivery={delivery} productId={product.id} dict={dict} />

      <ProductForm
        action={updateProduct}
        submitLabel={dict.common.saveChanges}
        defaultValues={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description ?? "",
          type: product.type,
          status: product.status,
          thumbnailKey: product.thumbnailKey ?? "",
          thumbnailUrl,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t.offers.title}</CardTitle>
          <CardDescription>{t.offers.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {offers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.offers.empty}</p>
          ) : (
            offers.map((offer) => (
              <div key={offer.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <Link href={`/offers/${offer.id}`} className="text-sm font-medium hover:underline">
                    {offer.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{dict.offers.billingTypes[offer.billingType]}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular text-sm font-medium">{formatAmount(offer.amount, offer.currency)}</span>
                  <Badge variant={offer.active ? "success" : "secondary"}>{offer.active ? t.offers.active : t.offers.inactive}</Badge>
                </div>
              </div>
            ))
          )}
          <Button variant="outline" size="sm" render={<Link href={`/offers/new?productId=${product.id}`} />}>
            <PlusIcon />
            {t.offers.new}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
