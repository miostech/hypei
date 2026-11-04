import { ArchiveIcon, ExternalLinkIcon, LinkIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLink } from "@/app/(app)/affiliates/copy-link";
import { DeliveryWarning } from "@/components/shared/delivery-warning";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";
import { getEnv } from "@/lib/env";
import { NotFoundError } from "@/lib/errors";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { formatAmount } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { archiveProduct, updateProduct } from "../actions";
import { ProductForm } from "../product-form";
import { AffiliationCard } from "./affiliation-card";
import { ProductCheckoutTab } from "./checkout-tab";
import { ProductTabs, resolveProductTab } from "./product-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAppDictionary(await appLocale());
  return { title: dict.products.title };
}

export default async function ProductPage({ params, searchParams }: PageProps<"/products/[productId]">) {
  const { productId } = await params;
  const { organization } = await requirePagePermission("products:read");
  const services = getServices();
  const query = await searchParams;
  const tab = resolveProductTab(query.aba);

  const product = await services.products.get(organization.id, productId).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const [delivery, dict] = await Promise.all([
    services.products.delivery(organization.id, product.id),
    getAppDictionary(await appLocale()),
  ]);
  const t = dict.productForm;

  // Cada aba busca só o que ela mostra: abrir o produto para mexer no preço não precisa custar
  // a lista de checkouts nem a de afiliados.
  const offers =
    tab === "geral" || tab === "checkout"
      ? (await services.offers.list(organization.id)).filter((offer) => offer.productId === product.id)
      : [];
  const checkouts =
    tab === "checkout" || tab === "links"
      ? (await services.checkouts.list(organization.id)).filter((checkout) => checkout.offer.productId === product.id)
      : [];

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

      <ProductTabs productId={product.id} active={tab} labels={t.tabs} />

      <DeliveryWarning delivery={delivery} productId={product.id} dict={dict} />

      {tab === "geral" && (
        <>
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
              thumbnailUrl: await services.products.thumbnailUrl(product.thumbnailKey),
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
      )}

      {tab === "checkout" && (
        <ProductCheckoutTab
          organization={{ id: organization.id, country: organization.country }}
          productId={product.id}
          checkouts={checkouts}
          hasActiveOffer={offers.some((offer) => offer.active)}
          selectedId={typeof query.checkout === "string" ? query.checkout : undefined}
          dict={dict}
        />
      )}

      {tab === "afiliados" && (
        <AffiliationCard
          productId={product.id}
          enabled={product.affiliationEnabled}
          commission={((product.affiliateCommissionBps ?? 3000) / 100).toString().replace(".", ",")}
          inviteUrl={product.affiliateInviteCode ? `${getEnv().APP_URL}/afiliados/${product.affiliateInviteCode}` : null}
          affiliateCount={
            (await services.affiliates.list(organization.id)).filter((affiliate) =>
              affiliate.affiliations.some((a) => a.productId === product.id),
            ).length
          }
        />
      )}

      {tab === "links" && (
        <Card>
          <CardHeader>
            <CardTitle>{t.links.title}</CardTitle>
            <CardDescription>{t.links.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {checkouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.links.empty}</p>
            ) : (
              checkouts.map((checkout) => (
                <div key={checkout.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${product.id}?aba=checkout&checkout=${checkout.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {checkout.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{checkout.offer.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={checkout.status === "ACTIVE" ? "success" : "secondary"}>
                      {checkout.status === "ACTIVE" ? dict.checkouts.active : dict.checkouts.inactive}
                    </Badge>
                    <CopyLink url={`${getEnv().APP_URL}/checkout/${checkout.slug}`} label={checkout.name} />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={dict.checkouts.open}
                      render={<Link href={`/checkout/${checkout.slug}`} target="_blank" />}
                    >
                      <ExternalLinkIcon />
                    </Button>
                  </div>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" render={<Link href={`/checkouts/new?productId=${product.id}`} />}>
              <LinkIcon />
              {dict.checkouts.new}
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
