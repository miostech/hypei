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
import { formatAmount, formatDate, formatDateTime } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { SimulateSettlementButton } from "./simulate-settlement";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).finance.eyebrow };
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
  const { organization } = await requirePagePermission("finance:read");
  const services = getServices();
  const params = await searchParams;
  const currencies = await services.finance.currencies(organization.id, organization.defaultCurrency);
  const requested = typeof params.currency === "string" ? params.currency : undefined;
  const currency = requested && currencies.includes(requested) ? requested : currencies[0];

  const dict = await getAppDictionary(await appLocale());
  const t = dict.finance;

  const [summary, movements, nextAvailable] = await Promise.all([
    services.finance.summary(organization.id, currency),
    services.finance.movements(organization.id, currency, 40),
    services.finance.nextAvailableDate(organization.id, currency),
  ]);

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
                    render={<Link href={`/finance?currency=${code}`} />}
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
          responde. O saldo fica nos cards ao lado, um por estado, e tem a tela de Saques
          inteira para ele.
        */}
        <BalanceHero
          dict={dict}
          className="lg:col-span-2"
          currency={currency}
          label={t.grossRevenue}
          amount={formatAmount(summary.grossRevenue, currency)}
          footnote={t.grossRevenueHint}
          actions={
            <Button className="bg-gold-gradient border-0 text-gold-foreground shadow-gold hover:opacity-90" render={<Link href="/payouts" />}>
              <BanknoteIcon />
              {t.requestPayout}
            </Button>
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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label={t.refunds} value={formatAmount(summary.refunds, currency)} icon={RotateCcwIcon} tone="muted" />
        <StatCard label={t.chargebacks} value={formatAmount(summary.chargebacks, currency)} icon={AlertTriangleIcon} tone="muted" />
        <StatCard label={t.reserved} value={formatAmount(summary.reserved, currency)} icon={LockIcon} tone={summary.reserved > 0n ? "warning" : "muted"} hint={t.reservedHint} />
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
              {movements.map((row) => {
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
        </CardContent>
      </Card>
    </>
  );
}
