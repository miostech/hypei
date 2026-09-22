import { BarChart3Icon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";

export const metadata = { title: "Analytics" };

const FUNNEL: { key: string; label: string }[] = [
  { key: "checkout.viewed", label: "Checkout visto" },
  { key: "checkout.customer_created", label: "Dados preenchidos" },
  { key: "checkout.payment_started", label: "Pagamento iniciado" },
  { key: "checkout.completed", label: "Compra concluída" },
];

export default async function AnalyticsPage() {
  const { organization } = await requirePagePermission("analytics:read");
  const services = getServices();
  const [counts, sources] = await Promise.all([
    services.tracking.funnel(organization.id, 30),
    services.tracking.topSources(organization.id, 30),
  ]);

  const views = counts["checkout.viewed"] ?? 0;
  const completed = counts["checkout.completed"] ?? 0;
  const conversion = views > 0 ? ((completed / views) * 100).toFixed(1) : "0,0";
  const hasData = Object.values(counts).some((v) => v > 0);

  return (
    <>
      <PageHeader title="Analytics" description="Eventos de checkout dos últimos 30 dias, armazenados no MongoDB." />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Visitas ao checkout" value={String(views)} />
        <StatCard label="Compras concluídas" value={String(completed)} tone="positive" />
        <StatCard label="Conversão" value={`${conversion}%`} tone="muted" />
      </section>

      {!hasData ? (
        <EmptyState icon={BarChart3Icon} title="Sem dados ainda" description="Os eventos aparecem assim que visitarem seu checkout." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Funil de checkout</CardTitle>
              <CardDescription>Da visita até a compra.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {FUNNEL.map((step) => {
                const value = counts[step.key] ?? 0;
                const pct = views > 0 ? Math.round((value / views) * 100) : 0;
                return (
                  <div key={step.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{step.label}</span>
                      <span className="tabular text-muted-foreground">
                        {value} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Principais origens</CardTitle>
              <CardDescription>utm_source das visitas ao checkout.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {sources.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem origens registradas.</p>
              ) : (
                sources.map((source) => (
                  <div key={source.source} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                    <span>{source.source}</span>
                    <span className="tabular text-muted-foreground">{source.count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
