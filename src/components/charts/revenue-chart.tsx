"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface RevenuePoint {
  /** Axis label, already localized (e.g. "14 set"). */
  label: string;
  /** Full date label used in the tooltip. */
  fullLabel: string;
  /** Minor units as a number — bigint never crosses the server/client boundary. */
  value: number;
}

function formatter(currency: string, locale: string, compact = false) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: compact ? 1 : 2,
    notation: compact ? "compact" : "standard",
  });
}

/**
 * Daily paid volume. Single series, so no legend: the card title names it.
 * Values are read from the tooltip and the axis, never printed on every point.
 */
export function RevenueChart({
  data,
  currency,
  locale = "pt-BR",
  height = 260,
}: {
  data: RevenuePoint[];
  currency: string;
  locale?: string;
  height?: number;
}) {
  const money = formatter(currency, locale);
  const compact = formatter(currency, locale, true);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="4 6" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={32}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={62}
            tickCount={4}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickFormatter={(value: number) => compact.format(value / 100)}
          />
          <Tooltip
            cursor={{ stroke: "var(--chart-1)", strokeWidth: 1, strokeDasharray: "4 4" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as RevenuePoint;
              return (
                <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-card">
                  <p className="text-muted-foreground">{point.fullLabel}</p>
                  <p className="tabular mt-0.5 font-heading text-sm font-semibold">{money.format(point.value / 100)}</p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#revenue-fill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
