import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppDictionary } from "@/lib/i18n/app";
import { fill, plural } from "@/lib/i18n/locale";
import { formatAmount } from "@/lib/ui/format";
import type { FinanceTerms } from "@/modules/balances/finance-overview.service";
import { FastSettlementButton } from "./fast-settlement-button";

/**
 * As condições desta conta, lidas das mesmas políticas que valem na hora da venda.
 *
 * Nada aqui é texto fixo: se a organização tem condição negociada, é a dela que aparece.
 */
export function TermsTab({ dict, terms, payoutFee, canRequestFast }: {
  dict: AppDictionary;
  terms: FinanceTerms;
  payoutFee: bigint;
  canRequestFast: boolean;
}) {
  const t = dict.finance.terms;
  const { currency } = terms;
  const days = (count: number) => plural(dict.locale, count, t.days);
  const percentage = (terms.platformFee.percentageBps / 100).toLocaleString(dict.localeTag, { minimumFractionDigits: 2 });

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-1">
        <section>
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t.fee}</h3>
          <p className="mt-1.5 text-base font-medium">
            {fill(t.feeValue, { percentage, amount: formatAmount(terms.platformFee.fixedAmount, currency) })}
          </p>
        </section>

        <section>
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t.settlement}</h3>
          <dl className="mt-1.5 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">{t.card}</dt>
              <dd className="text-base font-medium">{days(terms.settlementDays.card)}</dd>
              {/* O pedido só aparece para quem ainda não recebe rápido — e pode solicitar. */}
              {!terms.fastCardSettlement && canRequestFast && <FastSettlementButton />}
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t.pix}</dt>
              <dd className="text-base font-medium">{days(terms.settlementDays.pix)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t.boleto}</dt>
              <dd className="text-base font-medium">{days(terms.settlementDays.boleto)}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t.payoutFee}</h3>
          <p className="mt-1.5 text-base font-medium">{fill(t.payoutFeeValue, { amount: formatAmount(payoutFee, currency) })}</p>
        </section>
      </CardContent>
    </Card>
  );
}
