import {
  AlertTriangleIcon,
  ArrowDownLeftIcon,
  BanknoteIcon,
  ClockIcon,
  LockIcon,
  type LucideIcon,
  ReceiptIcon,
  RotateCcwIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UnlockIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BalanceHero } from "@/components/shared/balance-hero";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill } from "@/lib/i18n/locale";
import { isMerchantAccountReadyForPayouts } from "@/lib/providers/payment/merchant-status";
import { formatAmount, formatDate, formatDateTime } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { getServices } from "@/server/container";
import { FinanceTabs, resolveFinanceTab } from "./finance-tabs";
import { PayoutsTab } from "./payouts-tab";
import { RequestPayoutDialog } from "./request-payout-dialog";
import { SimulateSettlementButton } from "./simulate-settlement";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).finance.eyebrow };
}

/** Quantas movimentações entram por vez — a primeira página e cada "Ver mais". */
const MOVEMENTS_PAGE = 10;

/**
 * Quantas movimentações mostrar, lido da URL.
 *
 * Fica na URL em vez de no cliente para o extrato nascer pronto no servidor: a página volta
 * igual se ela recarregar ou mandar o link. Valor estranho cai na primeira página, e o teto
 * existe para ninguém pedir dez mil lançamentos trocando o número à mão.
 */
function visibleMovements(value: string | string[] | undefined): number {
  const parsed = Number(typeof value === "string" ? value : "");
  if (!Number.isFinite(parsed)) return MOVEMENTS_PAGE;
  return Math.min(Math.max(Math.trunc(parsed), MOVEMENTS_PAGE), 200);
}

/** Each journal type gets its own icon + tone, so a movement is readable at a glance. */
const MOVEMENT_STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  "payment.captured": { icon: ShoppingBagIcon, className: "bg-success/10 text-success" },
  "settlement.released": { icon: UnlockIcon, className: "bg-accent text-accent-foreground" },
  "refund.completed": { icon: RotateCcwIcon, className: "bg-destructive/10 text-destructive" },
  "dispute.hold": { icon: LockIcon, className: "bg-warning/12 text-warning" },
  "dispute.won": { icon: SparklesIcon, className: "bg-success/10 text-success" },
  "dispute.lost": { icon: AlertTriangleIcon, className: "bg-destructive/10 text-destructive" },
  "payout.initiated": { icon: ArrowDownLeftIcon, className: "bg-gold/15 text-warning" },
  "payout.paid": { icon: BanknoteIcon, className: "bg-gold/15 text-warning" },
  "payout.reversed": { icon: RotateCcwIcon, className: "bg-warning/12 text-warning" },
};

export default async function FinancePage({ searchParams }: PageProps<"/finance">) {
  const { organization, membership } = await requirePagePermission("finance:read");
  const services = getServices();
  const params = await searchParams;
  const currencies = await services.finance.currencies(organization.id, organization.defaultCurrency);
  const requested = typeof params.currency === "string" ? params.currency : undefined;
  const currency = requested && currencies.includes(requested) ? requested : currencies[0];
  const tab = resolveFinanceTab(typeof params.aba === "string" ? params.aba : undefined);
  const shown = visibleMovements(params.mostrar);

  const dict = await getAppDictionary(await appLocale());
  const t = dict.finance;

  // O saldo e a conta de recebimento aparecem nas duas abas: é o cabeçalho da tela, não da aba.
  const [summary, nextAvailable, merchant, movements, payouts] = await Promise.all([
    services.finance.summary(organization.id, currency),
    services.finance.nextAvailableDate(organization.id, currency),
    services.merchantAccounts.getForOrganization(organization.id),
    // Uma a mais do que cabe na tela: é assim que a página sabe se ainda há o que mostrar.
    tab === "movimentacoes" ? services.finance.movements(organization.id, currency, shown + 1) : [],
    tab === "saques" ? services.payouts.list(organization.id) : [],
  ]);

  const hasMoreMovements = movements.length > shown;
  const payoutFee = services.payouts.feeFor(currency);
  const ready = merchant ? isMerchantAccountReadyForPayouts(merchant) : false;
  const canRequest = hasPermission(membership.role, "payouts:request");

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        actions={
          <>
            {currencies.length > 1 && (
              <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
                {currencies.map((code) => (
                  <Button
                    key={code}
                    size="sm"
                    variant={code === currency ? "default" : "ghost"}
                    className="h-7 rounded-lg px-2.5"
                    render={<Link href={`/finance?aba=${tab}&currency=${code}`} />}
                  >
                    {code}
                  </Button>
                ))}
              </div>
            )}
            {process.env.APP_ENV !== "production" && <SimulateSettlementButton />}
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        {/*
          No Financeiro o número grande é o quanto ela já vendeu — a pergunta que esta tela
          responde. O saldo fica nos cards ao lado, um por estado, e o saque sai daqui mesmo.
        */}
        <BalanceHero
          dict={dict}
          className="lg:col-span-2"
          currency={currency}
          label={t.grossRevenue}
          amount={formatAmount(summary.grossRevenue, currency)}
          footnote={t.grossRevenueHint}
          actions={
            canRequest ? (
              <RequestPayoutDialog
                currency={currency}
                availableAmount={summary.available.toString()}
                availableLabel={formatAmount(summary.available, currency)}
                feeAmount={payoutFee.toString()}
                feeLabel={formatAmount(payoutFee, currency)}
                disabled={!ready || summary.available <= payoutFee}
              />
            ) : undefined
          }
        />

        {/* O saldo, em dois tempos: o que já dá para sacar e o que ainda está no prazo. */}
        <div className="grid gap-4 self-start sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            label={dict.balance.availableForPayout}
            value={formatAmount(summary.available, currency)}
            icon={BanknoteIcon}
            tone="positive"
            hint={nextAvailable ? fill(t.nextRelease, { date: formatDate(nextAvailable, dict.localeTag) }) : t.noRelease}
          />
          <StatCard
            label={dict.balance.pending}
            value={formatAmount(summary.pending, currency)}
            icon={ClockIcon}
            tone="muted"
            hint={t.pendingHint}
          />
        </div>
      </section>

      <FinanceTabs active={tab} currency={currency} labels={t.tabs} />

      {tab === "saques" ? (
        <PayoutsTab dict={dict} payouts={payouts} currency={currency} ready={ready} hasMerchantAccount={merchant !== null} />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label={t.refunds} value={formatAmount(summary.refunds, currency)} icon={RotateCcwIcon} tone="muted" />
            <StatCard label={t.chargebacks} value={formatAmount(summary.chargebacks, currency)} icon={AlertTriangleIcon} tone="muted" />
            <StatCard
              label={t.reserved}
              value={formatAmount(summary.reserved, currency)}
              icon={LockIcon}
              tone={summary.reserved > 0n ? "warning" : "muted"}
              hint={t.reservedHint}
            />
          </section>

          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>{t.movementsTitle}</CardTitle>
              <CardDescription>{t.movementsDescription}</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {movements.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">{t.noMovements}</p>
              ) : (
                <ul className="divide-y">
                  {movements.slice(0, shown).map((row) => {
                    const style = MOVEMENT_STYLE[row.type] ?? { icon: ReceiptIcon, className: "bg-muted text-muted-foreground" };
                    const Icon = style.icon;
                    return (
                      <li key={row.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50">
                        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${style.className}`}>
                          <Icon className="size-4.5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{row.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.journalTypes[row.type as keyof typeof t.journalTypes] ?? row.type} · {formatDateTime(row.date, dict.localeTag)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`tabular text-sm font-semibold ${
                              row.amount > 0n ? "text-success" : row.amount < 0n ? "text-destructive" : "text-muted-foreground"
                            }`}
                          >
                            {row.amount > 0n ? "+" : ""}
                            {formatAmount(row.amount, currency)}
                          </p>
                          <p className="tabular text-xs text-muted-foreground">
                            {fill(t.balanceAfter, { amount: formatAmount(row.balanceAfter, currency) })}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {hasMoreMovements && (
                <div className="px-5 pt-4">
                  <Button
                    variant="outline"
                    className="w-full"
                    render={
                      <Link
                        href={`/finance?aba=movimentacoes&currency=${currency}&mostrar=${shown + MOVEMENTS_PAGE}`}
                        // Sem pular para o topo: ela clicou no fim da lista e é lá que quer continuar.
                        scroll={false}
                      />
                    }
                  >
                    {t.showMore}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
