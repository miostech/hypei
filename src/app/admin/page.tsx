import { AlertTriangleIcon, BanknoteIcon, BuildingIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/ui/format";
import { ADMIN_PERIOD_PHRASE, parseAdminPeriod } from "@/modules/admin/admin-period";
import { getServices } from "@/server/container";
import { AdminPeriodTabs } from "./period-tabs";

export const metadata = { title: "Admin" };

const ORGANIZATION_STATUS: Record<string, string> = {
  ONBOARDING: "Em onboarding",
  ACTIVE: "Ativa",
  SUSPENDED: "Suspensa",
  CLOSED: "Encerrada",
};

/** Sums a per-currency list for display; mixed currencies are shown side by side. */
function MoneyList({ entries, empty }: { entries: { currency: string; amount: bigint }[]; empty: string }) {
  if (entries.length === 0) return <span className="text-muted-foreground">{empty}</span>;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {entries.map((entry) => (
        <span key={entry.currency}>{formatAmount(entry.amount, entry.currency)}</span>
      ))}
    </span>
  );
}

export default async function AdminHomePage({ searchParams }: PageProps<"/admin">) {
  const period = parseAdminPeriod((await searchParams).periodo);
  const overview = await getServices().platformAdmin.overview(period);
  const phrase = ADMIN_PERIOD_PHRASE[period];

  const sales = byCurrency(overview.volume.map((row) => ({ currency: row.currency, amount: row.total })));
  const revenue = byCurrency(overview.revenue.map((row) => ({ currency: row.currency, amount: row.net })));
  const profit = byCurrency(overview.profit.map((row) => ({ currency: row.currency, amount: row.net })));
  const accumulated = byCurrency(overview.revenueAllTime.map((row) => ({ currency: row.currency, amount: row.net })));
  const payments = overview.volume.reduce((total, row) => total + row.count, 0);
  const negative = overview.profit.some((row) => row.net < 0n);

  return (
    <>
      <PageHeader
        title="Visão da plataforma"
        description={`Números de toda a Kabrun. Vendas, taxa e lucro são ${phrase}; dívidas e cadastros são a posição de agora.`}
      />

      <AdminPeriodTabs active={period} />

      {/*
        Três números na ordem em que a pergunta é feita: quanto entrou de venda, quanto disso é
        taxa nossa e quanto sobrou depois do adquirente.
      */}
      <section className={`grid gap-4 sm:grid-cols-2 ${period === "tudo" ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}>
        <StatCard
          label="Vendas (bruto)"
          value={sales ?? "—"}
          hint={payments > 0 ? `${payments} pagamento(s) ${phrase}` : "Nenhum pagamento no período"}
        />
        <StatCard
          label="Receita Kabrun"
          value={revenue ?? "—"}
          hint="Taxa cobrada, já descontados estornos"
          tone="positive"
        />
        <StatCard
          label="Lucro líquido"
          value={profit ?? "—"}
          hint="Depois do que pagamos ao adquirente"
          tone={negative ? "warning" : "positive"}
        />
        {/* Em "todo o tempo" o acumulado É o recorte: dois cards com o mesmo número parecem erro. */}
        {period !== "tudo" && (
          <StatCard label="Taxas desde o início" value={accumulated ?? "—"} hint="Acumulado, fora do recorte" tone="muted" />
        )}
        <StatCard
          label="Disputas abertas"
          value={String(overview.openDisputes)}
          hint={`${overview.organizations.total} produtor(es) cadastrado(s)`}
          tone={overview.openDisputes > 0 ? "warning" : "muted"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle>Dinheiro em trânsito</CardTitle>
            <CardDescription>O que a plataforma deve ou ainda vai repassar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Saques na fila</span>
              <MoneyList
                entries={overview.pendingPayouts.map((row) => ({ currency: row.currency, amount: row.total }))}
                empty="Nenhum"
              />
            </p>
            <p className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Comissões a pagar</span>
              <MoneyList entries={overview.affiliatePayable.map((row) => ({ currency: row.currency, amount: row.net }))} empty="Nenhuma" />
            </p>

          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle>Precisa de atenção</CardTitle>
            <CardDescription>Fila de trabalho da operação.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <AttentionRow
              icon={AlertTriangleIcon}
              label="Disputas abertas"
              value={overview.openDisputes}
              href="/admin/disputes"
              tone={overview.openDisputes > 0 ? "warning" : "muted"}
            />
            <AttentionRow
              icon={BanknoteIcon}
              label="Saques aguardando"
              value={overview.pendingPayouts.reduce((total, row) => total + row.count, 0)}
              href="/admin/payouts"
              tone="muted"
            />
            <AttentionRow
              icon={ShieldCheckIcon}
              label="Verificações pendentes"
              value={overview.verificationPending}
              href="/admin/organizations"
              tone={overview.verificationPending > 0 ? "warning" : "muted"}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <BuildingIcon className="size-4 text-muted-foreground" aria-hidden />
            Organizações por status
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {overview.organizations.byStatus.map((row) => (
            <Badge key={row.status} variant={row.status === "ACTIVE" ? "success" : "outline"}>
              {ORGANIZATION_STATUS[row.status] ?? row.status}: {row.count}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function AttentionRow({
  icon: Icon,
  label,
  value,
  href,
  tone,
}: {
  icon: typeof AlertTriangleIcon;
  label: string;
  value: number;
  href: "/admin/disputes" | "/admin/payouts" | "/admin/organizations";
  tone: "warning" | "muted";
}) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted">
      <span
        className={`flex size-8 items-center justify-center rounded-lg ${tone === "warning" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"}`}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="flex-1 text-sm">{label}</span>
      <span className="tabular font-semibold">{value}</span>
    </Link>
  );
}

/**
 * Uma linha por moeda. Somar real com dólar daria um número que não existe, e empilhar as duas
 * numa linha só — "R$ 15.971,60 · $200.00" — vira um texto que ninguém lê como dois valores.
 * Devolve `null` quando não houve nada, para quem chama mostrar o traço.
 */
function byCurrency(entries: { currency: string; amount: bigint }[]): string[] | null {
  const real = entries.filter((entry) => entry.amount !== 0n);
  if (real.length === 0) return null;
  // Ordem alfabética — BRL, EUR, USD — porque o `GROUP BY` não promete nenhuma, e o mesmo card
  // trocava as moedas de lugar quando a operação mudava o recorte.
  return real.sort((a, b) => a.currency.localeCompare(b.currency)).map((entry) => formatAmount(entry.amount, entry.currency));
}
