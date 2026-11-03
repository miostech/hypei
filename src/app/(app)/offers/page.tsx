import { PlusIcon, TagIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Metadata } from "next";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { formatAmount } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAppDictionary(await appLocale());
  return { title: dict.offers.title };
}

export default async function OffersPage() {
  const { organization } = await requirePagePermission("products:read");
  const services = getServices();
  const [offers, products] = await Promise.all([services.offers.list(organization.id), services.products.list(organization.id)]);
  const dict = await getAppDictionary(await appLocale());
  const t = dict.offers;

  if (products.length === 0) {
    return (
      <>
        <PageHeader title={t.title} description={t.shortDescription} />
        <EmptyState
          icon={TagIcon}
          title={t.needProductTitle}
          description={t.needProductBody}
          action={<Button render={<Link href="/products/new" />}>{t.createProduct}</Button>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button render={<Link href="/offers/new" />}>
            <PlusIcon />
            {t.new}
          </Button>
        }
      />

      {offers.length === 0 ? (
        <EmptyState
          icon={TagIcon}
          title={t.emptyTitle}
          description={t.emptyBody}
          action={<Button render={<Link href="/offers/new" />}>{t.create}</Button>}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.offer}</TableHead>
                  <TableHead className="hidden lg:table-cell">{dict.common.product}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t.billing}</TableHead>
                  <TableHead className="hidden sm:table-cell">{dict.common.status}</TableHead>
                  <TableHead className="text-right">{dict.common.price}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((offer) => (
                  <TableRow key={offer.id}>
                    <TableCell className="max-w-[52vw] sm:max-w-none">
                      <Link href={`/offers/${offer.id}`} className="block truncate font-medium hover:underline">
                        {offer.name}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground lg:hidden">
                        {offer.product.name} · {t.billingTypes[offer.billingType]}
                      </span>
                      <Badge className="mt-1 sm:hidden" variant={offer.active ? "success" : "secondary"}>
                        {offer.active ? t.active : t.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{offer.product.name}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{t.billingTypes[offer.billingType]}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={offer.active ? "success" : "secondary"}>{offer.active ? t.active : t.inactive}</Badge>
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">{formatAmount(offer.amount, offer.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
