import { AlertCircleIcon, BanknoteIcon } from "lucide-react";
import Link from "next/link";
import type { Payout } from "@/generated/prisma/client";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppDictionary } from "@/lib/i18n/app";
import { fill, plural } from "@/lib/i18n/locale";
import { convertMoney, money } from "@/lib/money";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { PAYOUT_STATUS_VARIANT } from "./payout-status";

/** O histórico de saques: cada solicitação e o status dela até chegar na conta. */
export function PayoutsTab({
  dict,
  payouts,
  currency,
  ready,
  hasMerchantAccount,
}: {
  dict: AppDictionary;
  payouts: Payout[];
  currency: string;
  ready: boolean;
  hasMerchantAccount: boolean;
}) {
  const t = dict.payouts;
  const totalPaid = payouts.filter((p) => p.status === "PAID").reduce((acc, p) => acc + p.amount, 0n);

  return (
    <>
      {!ready && (
        <Alert>
          <AlertCircleIcon />
          <AlertTitle>{t.pendingVerification}</AlertTitle>
          <AlertDescription>
            {hasMerchantAccount ? t.notEnabled : t.noAccount}
            <Button variant="link" className="h-auto p-0" render={<Link href="/integrations" />}>
              {t.goToIntegrations}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>{t.historyTitle}</CardTitle>
          <CardDescription>{t.historyDescription}</CardDescription>
          <CardAction className="text-right">
            <p className="text-xs text-muted-foreground">{t.totalPaid}</p>
            <p className="tabular text-lg font-semibold">{formatAmount(totalPaid, currency)}</p>
            <p className="text-xs text-muted-foreground">{plural(dict.locale, payouts.length, t.requestCount)}</p>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {payouts.length === 0 ? (
            <div className="px-5 pb-2">
              <EmptyState icon={BanknoteIcon} title={t.emptyTitle} description={t.emptyBody} />
            </div>
          ) : (
            <ul className="divide-y">
              {payouts.map((payout) => (
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
                    {/* De onde este dinheiro veio, quando não nasceu nesta moeda: o valor de
                        origem e a cotação que a converteu, como foram congelados no saque. */}
                    {payout.sourceCurrency && payout.sourceAmount !== null && payout.exchangeRate !== null && (
                      <p className="text-xs text-muted-foreground">
                        {fill(t.convertedFrom, {
                          amount: formatAmount(payout.sourceAmount, payout.sourceCurrency),
                          currency: payout.sourceCurrency,
                          rate: formatAmount(convertMoney(money(100n, payout.sourceCurrency), payout.exchangeRate, payout.currency).amount, payout.currency),
                        })}
                      </p>
                    )}
                    {payout.failureReason && <p className="text-xs text-destructive">{payout.failureReason}</p>}
                  </div>
                  <Badge variant={PAYOUT_STATUS_VARIANT[payout.status]}>{t.statuses[payout.status]}</Badge>
                  <div className="w-32 text-right">
                    <p className="tabular text-sm font-semibold">{formatAmount(payout.amount, payout.currency)}</p>
                    {payout.feeAmount > 0n && (
                      <p className="tabular text-xs text-muted-foreground">
                        {fill(t.feeCharged, { amount: formatAmount(payout.feeAmount, payout.currency) })}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
