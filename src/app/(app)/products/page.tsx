import { PackageIcon, PlusIcon } from "lucide-react";
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
import { plural } from "@/lib/i18n/locale";
import { formatDate } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { CatalogTabs } from "./catalog-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAppDictionary(await appLocale());
  return { title: dict.products.title };
}

export default async function ProductsPage() {
  const { organization } = await requirePagePermission("products:read");
  const services = getServices();
  const [products, delivery] = await Promise.all([services.products.list(organization.id), services.products.deliveryByProduct(organization.id)]);
  const dict = await getAppDictionary(await appLocale());
  const t = dict.products;

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button render={<Link href="/products/new" />}>
            <PlusIcon />
            {t.new}
          </Button>
        }
      />

      <CatalogTabs active="mine" dict={dict} />

      {products.length === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title={t.emptyTitle}
          description={t.emptyBody}
          action={
            <Button render={<Link href="/products/new" />}>
              <PlusIcon />
              {t.create}
            </Button>
          }
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.common.product}</TableHead>
                  <TableHead className="hidden lg:table-cell">{dict.common.type}</TableHead>
                  <TableHead>{dict.common.status}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{t.offers}</TableHead>
                  <TableHead className="hidden md:table-cell">{t.createdAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  // Arquivado não vende, então não há entrega para avisar.
                  const content = delivery.get(product.id);
                  const issue = product.status !== "ARCHIVED" && content && !content.ready ? content.reason : null;

                  return (
                  <TableRow key={product.id}>
                    <TableCell className="max-w-[52vw] sm:max-w-none">
                      <Link href={`/products/${product.id}`} className="block truncate font-medium hover:underline">
                        {product.name}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">/{product.slug}</span>
                      <span className="block text-xs text-muted-foreground lg:hidden">
                        {t.types[product.type]} · {plural(dict.locale, product._count.offers, t.offerCount)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{t.types[product.type]}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={product.status === "ACTIVE" ? "success" : product.status === "DRAFT" ? "outline" : "secondary"}>
                          {t.statuses[product.status]}
                        </Badge>
                        {issue && <Badge variant="warning">{dict.delivery[issue].short}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="tabular hidden text-right text-muted-foreground sm:table-cell">{product._count.offers}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(product.createdAt, dict.localeTag)}</TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
