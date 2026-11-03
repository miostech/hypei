import { RepeatIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SubscriptionStatus } from "@/generated/prisma/enums";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill } from "@/lib/i18n/locale";
import { formatAmount, formatDate } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { CancelSubscriptionDialog } from "./cancel-dialog";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).subscriptions.title };
}

/** A cor do selo de cada status; o texto vem de `dict.subscriptions.statuses`. */
const STATUS_VARIANT: Record<SubscriptionStatus, "success" | "warning" | "destructive" | "outline"> = {
  ACTIVE: "success",
  TRIALING: "outline",
  PAST_DUE: "warning",
  PAUSED: "outline",
  UNPAID: "destructive",
  CANCELED: "outline",
};

const LIVE: SubscriptionStatus[] = ["ACTIVE", "TRIALING"];

export default async function SubscriptionsPage() {
  const { organization } = await requirePagePermission("sales:read");
  const subscriptions = await getServices().subscriptions.list(organization.id);
  const dict = await getAppDictionary(await appLocale());
  const t = dict.subscriptions;

  const live = subscriptions.filter((subscription) => LIVE.includes(subscription.status));
  const monthlyRevenue = live.reduce((total, subscription) => {
    // Everything is normalized to a monthly figure so the number means something.
    const perMonth =
      subscription.billingInterval === "YEAR"
        ? subscription.amount / 12n
        : subscription.billingInterval === "WEEK"
          ? subscription.amount * 4n
          : subscription.billingInterval === "DAY"
            ? subscription.amount * 30n
            : subscription.amount;
    return total + perMonth;
  }, 0n);
  const atRisk = subscriptions.filter((subscription) => subscription.status === "PAST_DUE" || subscription.status === "UNPAID");

  return (
    <>
      <PageHeader title={t.title} description={t.description} />

      {subscriptions.length === 0 ? (
        <EmptyState
          icon={RepeatIcon}
          title={t.emptyTitle}
          description={t.emptyBody}
          action={
            <Button variant="outline" render={<Link href="/offers" />}>
              {t.createOffer}
            </Button>
          }
        />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard label={t.activeCount} value={String(live.length)} hint={fill(t.ofTotal, { count: subscriptions.length })} />
            <StatCard
              label={t.recurringRevenue}
              value={formatAmount(monthlyRevenue, organization.defaultCurrency)}
              hint={t.perMonth}
            />
            <StatCard label={t.overdue} value={String(atRisk.length)} tone={atRisk.length > 0 ? "warning" : "muted"} />
          </section>

          <Card className="py-0">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.common.customer}</TableHead>
                    <TableHead className="hidden lg:table-cell">{dict.common.product}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t.recurrence}</TableHead>
                    <TableHead className="hidden text-right xl:table-cell">{t.cycles}</TableHead>
                    <TableHead className="hidden md:table-cell">{t.nextCharge}</TableHead>
                    <TableHead className="hidden sm:table-cell">{dict.common.status}</TableHead>
                    <TableHead className="text-right">{dict.common.amount}</TableHead>
                    <TableHead className="w-px" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((subscription) => {
                    const variant = STATUS_VARIANT[subscription.status];
                    const label = t.statuses[subscription.status];
                    const canCancel = subscription.status !== "CANCELED";
                    return (
                      <TableRow key={subscription.id}>
                        <TableCell className="max-w-[46vw] sm:max-w-none">
                          <span className="block truncate font-medium">{subscription.customer.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{subscription.customer.email}</span>
                          <span className="block truncate text-xs text-muted-foreground lg:hidden">
                            {subscription.offer.product.name}
                            {subscription.offer.billingInterval ? ` · ${dict.offers.billingIntervals[subscription.offer.billingInterval]}` : ""}
                          </span>
                          <Badge className="mt-1 sm:hidden" variant={variant}>
                            {label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">{subscription.offer.product.name}</TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {subscription.offer.billingInterval ? dict.offers.billingIntervals[subscription.offer.billingInterval] : "—"}
                        </TableCell>
                        <TableCell className="tabular hidden text-right text-muted-foreground xl:table-cell">
                          {subscription._count.payments}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                          {subscription.cancelAtPeriodEnd ? (
                            <span className="text-warning">
                              {fill(t.endsOn, {
                                date: subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd, dict.localeTag) : "—",
                              })}
                            </span>
                          ) : subscription.currentPeriodEnd ? (
                            formatDate(subscription.currentPeriodEnd, dict.localeTag)
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={variant}>{label}</Badge>
                        </TableCell>
                        <TableCell className="tabular text-right font-medium">
                          {formatAmount(subscription.amount, subscription.currency)}
                        </TableCell>
                        <TableCell>
                          {canCancel && (
                            <CancelSubscriptionDialog
                              subscriptionId={subscription.id}
                              customerName={subscription.customer.name}
                              periodEndLabel={
                                subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd, dict.localeTag) : null
                              }
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
