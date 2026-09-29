import { AlertTriangleIcon, BanknoteIcon, BuildingIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/ui/format";
import { ADMIN_WINDOW_DAYS } from "@/modules/admin/platform-admin.service";
import { getServices } from "@/server/container";

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

export default async function AdminHomePage() {
  const overview = await getServices().platformAdmin.overview();
  const primary = overview.volume[0];

  return (
    <>
      <PageHeader
        title="Visão da plataforma"
        description={`Números de toda a Ripay. Volume e vendas consideram os últimos ${ADMIN_WINDOW_DAYS} dias; os saldos são acumulados.`}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`Volume (${ADMIN_WINDOW_DAYS} dias)`}
          value={primary ? formatAmount(primary.total, primary.currency) : "—"}
          hint={primary ? `${primary.count} pagamento(s)` : "Nenhum pagamento no período"}
        />
        <StatCard
          label="Receita Ripay"
          value={overview.revenue[0] ? formatAmount(overview.revenue[0].net, overview.revenue[0].currency) : "—"}
          hint="Taxas acumuladas, já descontados estornos"
          tone="positive"
        />
        <StatCard label="Organizações" value={String(overview.organizations.total)} hint="Produtores cadastrados" />
        <StatCard
          label="Disputas abertas"
          value={String(overview.openDisputes)}
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
            <p className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Taxas do processador</span>
              <MoneyList entries={overview.processorFees.map((row) => ({ currency: row.currency, amount: row.net }))} empty="—" />
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
