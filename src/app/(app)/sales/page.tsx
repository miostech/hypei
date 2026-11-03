import { SearchIcon, ShoppingBagIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Metadata } from "next";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill } from "@/lib/i18n/locale";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { ORDER_STATUS_VARIANT, PAYMENT_STATUS_VARIANT } from "./order-status";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAppDictionary(await appLocale());
  return { title: dict.sales.title };
}

export default async function SalesPage({ searchParams }: PageProps<"/sales">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const { organization } = await requirePagePermission("sales:read");
  const { repos } = getServices().uow;
  const dict = await getAppDictionary(await appLocale());
  const t = dict.sales;
  const orders = query ? await repos.orders.search(organization.id, query, 100) : await repos.orders.list(organization.id, { limit: 100 });

  return (
    <>
      <PageHeader title={t.title} description={t.description} />

      <form className="flex flex-wrap gap-2">
        <Input
          name="q"
          defaultValue={query}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchLabel}
          className="min-w-0 flex-1 basis-full sm:basis-auto"
        />
        <Button type="submit" variant="outline">
          <SearchIcon />
          {dict.common.search}
        </Button>
        {query && (
          <Button variant="ghost" render={<Link href="/sales" />}>
            {dict.common.clear}
          </Button>
        )}
      </form>

      {orders.length === 0 ? (
        query ? (
          <EmptyState
            icon={SearchIcon}
            title={t.notFoundTitle}
            description={fill(t.notFoundBody, { query })}
            action={
              <Button variant="outline" render={<Link href="/sales" />}>
                {t.viewAll}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ShoppingBagIcon}
            title={t.emptyTitle}
            description={t.emptyBody}
            action={
              <Button variant="outline" render={<Link href="/checkouts" />}>
                {t.viewCheckouts}
              </Button>
            }
          />
        )
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">{dict.common.date}</TableHead>
                  <TableHead>{dict.common.customer}</TableHead>
                  <TableHead className="hidden lg:table-cell">{dict.common.product}</TableHead>
                  <TableHead className="hidden lg:table-cell">{dict.common.order}</TableHead>
                  <TableHead className="hidden sm:table-cell">{dict.common.payment}</TableHead>
                  <TableHead className="text-right">{dict.common.amount}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const payment = order.payments.at(-1);
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                        {formatDateTime(order.createdAt, dict.localeTag)}
                      </TableCell>
                      {/* Capped so the long e-mail truncates instead of pushing the amount off-screen. */}
                      <TableCell className="max-w-[52vw] sm:max-w-none">
                        <Link href={`/sales/${order.id}`} className="block truncate font-medium hover:underline">
                          {order.customer.name}
                        </Link>
                        <span className="block truncate text-xs text-muted-foreground">{order.customer.email}</span>
                        {/* The columns hidden on small screens come back as context here. */}
                        <span className="block truncate text-xs text-muted-foreground lg:hidden">
                          {order.items[0]?.productName ?? "—"}
                        </span>
                        <span className="block text-xs text-muted-foreground md:hidden">{formatDateTime(order.createdAt, dict.localeTag)}</span>
                        {payment && (
                          <Badge className="mt-1 sm:hidden" variant={PAYMENT_STATUS_VARIANT[payment.status]}>
                            {dict.status.payment[payment.status]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{order.items[0]?.productName ?? "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant={ORDER_STATUS_VARIANT[order.status]}>{dict.status.order[order.status]}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {payment ? (
                          <>
                            <Badge variant={PAYMENT_STATUS_VARIANT[payment.status]}>{dict.status.payment[payment.status]}</Badge>
                            {payment.paymentMethod && (
                              <span className="hidden text-xs text-muted-foreground sm:block">
                                {dict.status.paymentMethod[payment.paymentMethod]}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">{formatAmount(order.totalAmount, order.currency)}</TableCell>
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
