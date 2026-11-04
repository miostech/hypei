import { AlertCircleIcon, BanknoteIcon, ClockIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { BalanceHero } from "@/components/shared/balance-hero";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill, plural } from "@/lib/i18n/locale";
import { formatAmount, formatDate, formatDateTime } from "@/lib/ui/format";
import { isMerchantAccountReadyForPayouts } from "@/lib/providers/payment/merchant-status";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { getServices } from "@/server/container";
import { RequestPayoutDialog } from "./request-payout-dialog";
import { PAYOUT_STATUS_VARIANT } from "./payout-status";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).payouts.eyebrow };
}

export default async function PayoutsPage() {
  const { organization, membership } = await requirePagePermission("finance:read");
  const services = getServices();
  const currency = organization.defaultCurrency;

  const dict = await getAppDictionary(await appLocale());
  const t = dict.payouts;

  const [summary, payouts, merchant, nextAvailable] = await Promise.all([
    services.finance.summary(organization.id, currency),
    services.payouts.list(organization.id),
    services.merchantAccounts.getForOrganization(organization.id),
    services.finance.nextAvailableDate(organization.id, currency),
  ]);

  const canRequest = hasPermission(membership.role, "payouts:request");
  const ready = merchant ? isMerchantAccountReadyForPayouts(merchant) : false;
  const totalPaid = payouts.filter((p) => p.status === "PAID").reduce((acc, p) => acc + p.amount, 0n);

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      {!ready && (
        <Alert>
          <AlertCircleIcon />
          <AlertTitle>{t.pendingVerification}</AlertTitle>
          <AlertDescription>
            {merchant ? t.notEnabled : t.noAccount}
            <Button variant="link" className="h-auto p-0" render={<Link href="/integrations" />}>
              {t.goToIntegrations}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <BalanceHero
          dict={dict}
          className="lg:col-span-2"
          currency={currency}
          amount={formatAmount(summary.available, currency)}
          pending={formatAmount(summary.pending, currency)}
          footnote={
            nextAvailable ? fill(t.moreComing, { date: formatDateTime(nextAvailable, dict.localeTag) }) : dict.finance.noRelease
          }
          actions={
            canRequest ? (
              <RequestPayoutDialog
                currency={currency}
                availableAmount={summary.available.toString()}
                availableLabel={formatAmount(summary.available, currency)}
                disabled={!ready || summary.available <= 0n}
              />
            ) : undefined
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            label={t.totalPaid}
            value={formatAmount(totalPaid, currency)}
            icon={BanknoteIcon}
            tone="positive"
            hint={plural(dict.locale, payouts.length, t.requestCount)}
          />
          <StatCard
            label={t.nextRelease}
            value={nextAvailable ? formatDate(nextAvailable, dict.localeTag) : "—"}
            icon={ClockIcon}
            tone="muted"
            hint={t.nextReleaseHint}
          />
        </div>
      </section>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>{t.historyTitle}</CardTitle>
          <CardDescription>{t.historyDescription}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {payouts.length === 0 ? (
            <div className="px-5 pb-2">
              <EmptyState
                icon={BanknoteIcon}
                title={t.emptyTitle}
                description={t.emptyBody}
              />
            </div>
          ) : (
            <ul className="divide-y">
              {payouts.map((payout) => {
                return (
                  <li key={payout.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-warning">
                      <BanknoteIcon className="size-4.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t.requested}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(payout.requestedAt, dict.localeTag)}
                        {payout.paidAt ? ` · ${fill(t.paidOn, { date: formatDateTime(payout.paidAt, dict.localeTag) })}` : ""}
                      </p>
                      {payout.failureReason && <p className="text-xs text-destructive">{payout.failureReason}</p>}
                    </div>
                    <Badge variant={PAYOUT_STATUS_VARIANT[payout.status]}>{t.statuses[payout.status]}</Badge>
                    <p className="tabular w-32 text-right text-sm font-semibold">{formatAmount(payout.amount, payout.currency)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
