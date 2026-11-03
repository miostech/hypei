import { BarChart3Icon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";
import { getAppDictionary, type AppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAppDictionary(await appLocale());
  return { title: dict.analytics.title };
}

/** O evento como o MongoDB o guarda, e a chave do passo no dicionário. */
const FUNNEL: { key: string; step: keyof AppDictionary["analytics"]["funnel"] }[] = [
  { key: "checkout.viewed", step: "viewed" },
  { key: "checkout.customer_created", step: "customerCreated" },
  { key: "checkout.payment_started", step: "paymentStarted" },
  { key: "checkout.completed", step: "completed" },
];

export default async function AnalyticsPage() {
  const { organization } = await requirePagePermission("analytics:read");
  const services = getServices();
  const dict = await getAppDictionary(await appLocale());
  const t = dict.analytics;
  const [counts, sources] = await Promise.all([
    services.tracking.funnel(organization.id, 30),
    services.tracking.topSources(organization.id, 30),
  ]);

  const views = counts["checkout.viewed"] ?? 0;
  const completed = counts["checkout.completed"] ?? 0;
  // Uma casa decimal, com a vírgula ou o ponto de quem lê — `toFixed` sempre devolve ponto.
  const conversion = new Intl.NumberFormat(dict.localeTag, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    views > 0 ? (completed / views) * 100 : 0,
  );
  const hasData = Object.values(counts).some((v) => v > 0);

  return (
    <>
      <PageHeader title={t.title} description={t.description} />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t.views} value={String(views)} />
        <StatCard label={t.completed} value={String(completed)} tone="positive" />
        <StatCard label={t.conversion} value={`${conversion}%`} tone="muted" />
      </section>

      {!hasData ? (
        <EmptyState icon={BarChart3Icon} title={t.emptyTitle} description={t.emptyBody} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t.funnel.title}</CardTitle>
              <CardDescription>{t.funnel.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {FUNNEL.map((step) => {
                const value = counts[step.key] ?? 0;
                const pct = views > 0 ? Math.round((value / views) * 100) : 0;
                return (
                  <div key={step.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{t.funnel[step.step]}</span>
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
              <CardTitle>{t.sources.title}</CardTitle>
              <CardDescription>{t.sources.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {sources.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.sources.empty}</p>
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
