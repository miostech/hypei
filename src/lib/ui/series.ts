import type { RevenuePoint } from "@/components/charts/revenue-chart";

/**
 * Builds a continuous daily series (days without sales become zero) so the chart
 * shows real gaps instead of connecting distant points.
 */
export function buildDailySeries(rows: { day: Date; total: bigint }[], days: number, locale: string): RevenuePoint[] {
  const short = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" });
  const full = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "long", year: "numeric" });
  const byDay = new Map(rows.map((row) => [new Date(row.day).toISOString().slice(0, 10), Number(row.total)]));

  const series: RevenuePoint[] = [];
  const today = new Date();
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(today.getTime() - offset * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    series.push({
      // Sem tirar o ponto da abreviação: em alemão "07. Nov." é o dia, não uma sujeira.
      label: short.format(date),
      fullLabel: full.format(date),
      value: byDay.get(key) ?? 0,
    });
  }
  return series;
}
