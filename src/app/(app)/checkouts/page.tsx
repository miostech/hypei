import { CreditCardIcon, ExternalLinkIcon, PlusIcon } from "lucide-react";
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
  return { title: dict.checkouts.title };
}

export default async function CheckoutsPage() {
  const { organization } = await requirePagePermission("products:read");
  const services = getServices();
  const [checkouts, offers] = await Promise.all([services.checkouts.list(organization.id), services.offers.list(organization.id)]);
  const dict = await getAppDictionary(await appLocale());
  const t = dict.checkouts;

  if (offers.length === 0) {
    return (
      <>
        <PageHeader title={t.title} description={t.shortDescription} />
        <EmptyState
          icon={CreditCardIcon}
          title={t.needOfferTitle}
          description={t.needOfferBody}
          action={<Button render={<Link href="/offers/new" />}>{t.createOffer}</Button>}
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
          <Button render={<Link href="/checkouts/new" />}>
            <PlusIcon />
            {t.new}
          </Button>
        }
      />

      {checkouts.length === 0 ? (
        <EmptyState
          icon={CreditCardIcon}
          title={t.emptyTitle}
          description={t.emptyBody}
          action={<Button render={<Link href="/checkouts/new" />}>{t.create}</Button>}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.checkout}</TableHead>
                  <TableHead className="hidden lg:table-cell">{dict.offers.offer}</TableHead>
                  <TableHead className="hidden xl:table-cell">{t.version}</TableHead>
                  <TableHead className="hidden sm:table-cell">{dict.common.status}</TableHead>
                  <TableHead className="text-right">{dict.common.price}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkouts.map((checkout) => (
                  <TableRow key={checkout.id}>
                    <TableCell className="max-w-[46vw] sm:max-w-none">
                      <Link href={`/checkouts/${checkout.id}`} className="block truncate font-medium hover:underline">
                        {checkout.name}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">/checkout/{checkout.slug}</span>
                      <span className="block truncate text-xs text-muted-foreground lg:hidden">{checkout.offer.product.name}</span>
                      <Badge className="mt-1 sm:hidden" variant={checkout.status === "ACTIVE" ? "success" : "secondary"}>
                        {checkout.status === "ACTIVE" ? t.active : t.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{checkout.offer.product.name}</TableCell>
                    <TableCell className="tabular hidden text-muted-foreground xl:table-cell">v{checkout.currentVersion}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={checkout.status === "ACTIVE" ? "success" : "secondary"}>
                        {checkout.status === "ACTIVE" ? t.active : t.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-right">{formatAmount(checkout.offer.amount, checkout.offer.currency)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" aria-label={t.open} render={<Link href={`/checkout/${checkout.slug}`} target="_blank" />}>
                        <ExternalLinkIcon />
                      </Button>
                    </TableCell>
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
