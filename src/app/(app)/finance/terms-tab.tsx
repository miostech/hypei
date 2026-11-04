import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppDictionary } from "@/lib/i18n/app";
import { fill, plural } from "@/lib/i18n/locale";
import { formatAmount } from "@/lib/ui/format";
import type { FinanceTerms } from "@/modules/balances/finance-overview.service";
import { FastSettlementButton } from "./fast-settlement-button";

/**
 * As condições desta conta, lidas das mesmas políticas que valem na hora da venda.
 *
 * Um bloco por moeda, e não só a da conta: a oferta pode ser cobrada em qualquer uma das três, e
 * é a moeda da venda que decide a taxa, o prazo e a reserva. Nada aqui é texto fixo — se a
 * organização tem condição negociada, é a dela que aparece.
 */
export function TermsTab({ dict, terms, payoutFees, localCurrency, canRequestFast }: {
  dict: AppDictionary;
  terms: FinanceTerms[];
  /** A taxa de saque de cada moeda: ela é cobrada no saque, não na venda. */
  payoutFees: Record<string, bigint>;
  /** A moeda da própria conta, a única que pode pedir recebimento rápido. */
  localCurrency: string;
  canRequestFast: boolean;
}) {
  const t = dict.finance.terms;
  const days = (count: number) => plural(dict.locale, count, t.days);

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 pt-1">
        {terms.map((block) => {
          const { currency } = block;
          const percentage = (block.platformFee.percentageBps / 100).toLocaleString(dict.localeTag, { minimumFractionDigits: 2 });
          const isLocal = currency === localCurrency;

          return (
            <section key={currency}>
              <div className="flex flex-wrap items-center gap-2 border-b pb-2">
                <h3 className="text-sm font-medium">{t.scope[currency as keyof typeof t.scope]}</h3>
                {isLocal && <Badge variant="secondary">{t.scopeLocal}</Badge>}
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
                <dt className="text-sm text-muted-foreground">{t.fee}</dt>
                <dd className="text-sm font-medium">
                  {fill(t.feeValue, { percentage, amount: formatAmount(block.platformFee.fixedAmount, currency) })}
                </dd>

                <dt className="text-sm text-muted-foreground">{t.settlement}</dt>
                <dd className="text-sm font-medium">
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {block.settlementDays.map(({ method, days: count }) => (
                      <span key={method}>
                        <span className="text-muted-foreground">{t[method]}: </span>
                        {days(count)}
                      </span>
                    ))}
                  </span>
                  {/* O pedido só aparece na moeda da conta, que é a que ele muda — e para quem pode pedir. */}
                  {isLocal && !block.fastCardSettlement && canRequestFast && <FastSettlementButton />}
                </dd>

                <dt className="text-sm text-muted-foreground">{t.reserve}</dt>
                <dd className="text-sm font-medium">
                  {fill(t.reserveValue, {
                    percentage: (block.reserve.percentageBps / 100).toLocaleString(dict.localeTag),
                    days: days(block.reserve.holdDays),
                  })}
                </dd>

                <dt className="text-sm text-muted-foreground">{t.payoutFee}</dt>
                <dd className="text-sm font-medium">
                  {fill(t.payoutFeeValue, { amount: formatAmount(payoutFees[currency] ?? 0n, currency) })}
                </dd>
              </dl>
            </section>
          );
        })}

        <div className="space-y-1 border-t pt-4 text-xs text-muted-foreground">
          <p className="max-w-prose">{t.scopeHint}</p>
          <p className="max-w-prose">{t.reserveHint}</p>
        </div>
      </CardContent>
    </Card>
  );
}
