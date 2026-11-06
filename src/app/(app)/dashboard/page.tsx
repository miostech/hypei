import { ArrowRightIcon, ArrowUpRightIcon, HandshakeIcon, PackageIcon, ShoppingBagIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { TodaySalesHero } from "@/components/shared/today-sales-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill, plural } from "@/lib/i18n/locale";
import { formatAmount, formatDate } from "@/lib/ui/format";
import { timezoneForCountry, todayAgainstYesterday } from "@/lib/time/day-window";
import { buildDailySeries } from "@/lib/ui/series";
import { requireOrganization } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { ORDER_STATUS_VARIANT } from "../sales/order-status";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAppDictionary(await appLocale());
  return { title: dict.dashboard.title };
}

const WINDOW_DAYS = 30;

export default async function DashboardPage() {
  const { organization } = await requireOrganization();
  const services = getServices();
  const currency = organization.defaultCurrency;
  const locale = await appLocale();
  const dict = await getAppDictionary(locale);
  const d = dict.dashboard;

  // "Hoje" segue o fuso do produtor, não o do servidor.
  const day = todayAgainstYesterday(timezoneForCountry(organization.country));

  const windowStart = new Date(day.now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [orders, products, paid, daily, verification, today, yesterday, newStudents, referred] = await Promise.all([
    services.uow.repos.orders.list(organization.id, { limit: 6 }),
    services.products.list(organization.id),
    services.uow.repos.orders.paidSummary(organization.id, WINDOW_DAYS),
    services.uow.repos.orders.dailyPaidTotals(organization.id, WINDOW_DAYS),
    services.verification.overview(organization.id),
    services.uow.repos.orders.paidBetween(organization.id, day.todayStart, day.now),
    services.uow.repos.orders.paidBetween(organization.id, day.yesterdayStart, day.yesterdayEnd),
    services.uow.repos.orders.newCustomersBetween(organization.id, day.todayStart, day.now),
    services.affiliates.referredSummary(organization.id, windowStart),
  ]);

  const todaySales = today.find((row) => row.currency === currency);
  const todayTotal = todaySales?.total ?? 0n;
  const todayCount = todaySales?.count ?? 0;
  const yesterdayTotal = yesterday.find((row) => row.currency === currency)?.total ?? 0n;
  // Compared against the same stretch of yesterday, so a morning meets a morning.
  // With nothing to compare against, a percentage would be invented.
  const dayOverDay = yesterdayTotal > 0n ? Number(((todayTotal - yesterdayTotal) * 100n) / yesterdayTotal) : null;
  const todayAverageTicket = todayCount > 0 ? todayTotal / BigInt(todayCount) : 0n;

  // A venda que ela indicou é venda dela: aparece aqui, e não só na área de afiliações. Em
  // card próprio porque o valor é a comissão, não o preço — somar com o faturamento dos
  // produtos dela seria misturar o que ela cobrou com o que ela ganhou.
  const referredSales = referred.find((row) => row.currency === currency);

  const sales = paid.find((row) => row.currency === currency);
  const salesTotal = sales?.total ?? 0n;
  const salesCount = sales?.count ?? 0;
  const series = buildDailySeries(
    daily.filter((row) => row.currency === currency),
    WINDOW_DAYS,
    dict.localeTag,
  );

  return (
    <>
      <PageHeader
        eyebrow={d.eyebrow}
        title={fill(d.greeting, { name: organization.name })}
        description={d.description}
        actions={
          <>
            <Button variant="outline" render={<Link href="/checkouts" />}>
              {d.viewCheckouts}
            </Button>
            <Button render={<Link href="/products/new" />}>
              <PackageIcon />
              {d.newProduct}
            </Button>
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <TodaySalesHero
          className="lg:col-span-2"
          currency={currency}
          total={formatAmount(todayTotal, currency)}
          count={todayCount}
          newStudents={newStudents}
          averageTicket={formatAmount(todayAverageTicket, currency)}
          yesterday={formatAmount(yesterdayTotal, currency)}
          changePercent={dayOverDay}
          dict={dict}
          actions={
            <>
              <Button className="bg-gold-gradient border-0 text-gold-foreground shadow-gold hover:opacity-90" render={<Link href="/sales" />}>
                <ShoppingBagIcon />
                {d.today.viewSales}
              </Button>
              <Button variant="ghost" className="text-white hover:bg-white/12 hover:text-white" render={<Link href="/finance" />}>
                {d.today.viewFinance}
                <ArrowUpRightIcon />
              </Button>
            </>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            label={fill(d.salesWindow, { days: WINDOW_DAYS })}
            value={formatAmount(salesTotal, currency)}
            icon={ShoppingBagIcon}
            hint={plural(locale, salesCount, d.today.paidOrders)}
          />
          {referredSales && referredSales.count > 0 && (
            <StatCard
              label={fill(d.referredWindow, { days: WINDOW_DAYS })}
              value={formatAmount(referredSales.total, currency)}
              icon={HandshakeIcon}
              tone="positive"
              hint={plural(locale, referredSales.count, d.referredSales)}
            />
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b pb-4">
            <CardTitle>{d.chart.title}</CardTitle>
            <CardDescription>{fill(d.chart.description, { days: WINDOW_DAYS })}</CardDescription>
          </CardHeader>
          <CardContent>
            {salesCount === 0 ? (
              <div className="flex h-[260px] flex-col items-center justify-center gap-1 text-center">
                <p className="text-sm font-medium">{d.chart.emptyTitle}</p>
                <p className="text-sm text-muted-foreground">{d.chart.emptyBody}</p>
              </div>
            ) : (
              <RevenueChart data={series} currency={currency} locale={dict.localeTag} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle>{d.steps.title}</CardTitle>
            <CardDescription>{d.steps.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Step done={products.length > 0} href="/products/new" label={d.steps.product} />
            <Step done={products.some((p) => p._count.offers > 0)} href="/offers/new" label={d.steps.offer} />
            <Step done={orders.length > 0} href="/checkouts/new" label={d.steps.checkout} />
            <Step done={verification.canWithdraw} href="/verification" label={d.steps.verification} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex-row items-center justify-between border-b pb-4">
          <div>
            <CardTitle>{d.recent.title}</CardTitle>
            <CardDescription>{d.recent.description}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" render={<Link href="/sales" />}>
            {d.recent.viewAll}
            <ArrowRightIcon />
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {orders.length === 0 ? (
            <div className="px-5 pb-2">
              <EmptyState
                icon={ShoppingBagIcon}
                title={d.recent.emptyTitle}
                description={d.recent.emptyBody}
                action={
                  <Button variant="outline" render={<Link href="/checkouts/new" />}>
                    {d.recent.createCheckout}
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">{dict.common.customer}</TableHead>
                  <TableHead className="hidden lg:table-cell">{dict.common.product}</TableHead>
                  <TableHead className="hidden sm:table-cell">{dict.common.status}</TableHead>
                  <TableHead className="pr-5 text-right">{dict.common.amount}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="max-w-[52vw] pl-5 sm:max-w-none">
                      <span className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent font-heading text-xs font-semibold text-accent-foreground">
                          {order.customer.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{order.customer.name}</span>
                          <span className="block truncate text-xs text-muted-foreground lg:hidden">
                            {order.items[0]?.productName ?? "—"}
                          </span>
                          <span className="block text-xs text-muted-foreground">{formatDate(order.createdAt, dict.localeTag)}</span>
                          <Badge className="mt-1 sm:hidden" variant={ORDER_STATUS_VARIANT[order.status]}>
                            {dict.status.order[order.status]}
                          </Badge>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{order.items[0]?.productName ?? "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={ORDER_STATUS_VARIANT[order.status]}>{dict.status.order[order.status]}</Badge>
                    </TableCell>
                    <TableCell className="tabular pr-5 text-right font-medium">{formatAmount(order.totalAmount, order.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Step({ done, href, label }: { done: boolean; href: Route; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm transition-colors hover:border-primary/30 hover:bg-accent/50"
    >
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={`flex size-5 items-center justify-center rounded-full text-[0.6rem] font-bold ${
            done ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
          }`}
        >
          {done ? "✓" : ""}
        </span>
        <span className={done ? "text-muted-foreground line-through" : "font-medium"}>{label}</span>
      </span>
      <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
