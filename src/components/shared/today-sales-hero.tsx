import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * What the producer opens the dashboard to see: how today is going. Balance lives
 * in Financeiro — a number that only changes on settlement does not belong in the
 * place someone checks every hour.
 *
 * Amounts arrive already formatted (money never crosses as bigint).
 */
export function TodaySalesHero({
  currency,
  total,
  count,
  newStudents,
  averageTicket,
  yesterday,
  changePercent,
  actions,
  className,
}: {
  currency: string;
  total: string;
  /** Paid orders today; the average ticket is measured over them. */
  count: number;
  /** People whose first purchase landed today. */
  newStudents: number;
  averageTicket: string;
  /** Same stretch of yesterday, so the comparison is fair. */
  yesterday: string;
  /** null when yesterday had nothing to compare against. */
  changePercent: number | null;
  actions?: ReactNode;
  className?: string;
}) {
  const positive = (changePercent ?? 0) >= 0;

  return (
    <section
      className={cn("bg-brand-gradient relative isolate overflow-hidden rounded-2xl p-6 text-white shadow-lift sm:p-7", className)}
    >
      <span aria-hidden className="bg-dot-grid pointer-events-none absolute inset-0 text-white/15 opacity-40" />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(242_199_92/0.35),transparent_65%)]"
      />
      <svg aria-hidden viewBox="0 0 40 40" className="pointer-events-none absolute -right-6 -bottom-10 size-56 opacity-[0.09]">
        <path d="M26.4 17.6 19.4 26h3.7l-3.9 7.2 9.1-9.1h-4.1z" fill="#F2C75C" />
      </svg>

      <div className="relative flex flex-col gap-6">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-white/70 uppercase">
            Vendas de hoje
            <span className="rounded-full bg-white/12 px-1.5 py-0.5 text-[0.65rem] tracking-normal text-white/80">{currency}</span>
          </p>
          <p className="tabular mt-2 font-heading text-4xl leading-none font-extrabold sm:text-5xl">{total}</p>
          <p className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-white/75">
            {count === 0 ? (
              "Nenhum pagamento confirmado ainda hoje."
            ) : (
              <>
                <span>
                  {newStudents > 0
                    ? `${newStudents} ${newStudents === 1 ? "novo aluno" : "novos alunos"}`
                    : `${count} ${count === 1 ? "pedido pago" : "pedidos pagos"}`}
                </span>
                {changePercent !== null && (
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                      positive ? "bg-white/15" : "bg-black/20",
                    )}
                  >
                    {positive ? <TrendingUpIcon className="size-3.5" aria-hidden /> : <TrendingDownIcon className="size-3.5" aria-hidden />}
                    {positive ? "+" : ""}
                    {changePercent}% vs. ontem
                  </span>
                )}
              </>
            )}
          </p>
        </div>

        <dl className="flex flex-wrap gap-x-10 gap-y-3">
          <div>
            <dt className="text-xs text-white/60">Ontem até esta hora</dt>
            <dd className="tabular mt-0.5 font-heading text-lg font-semibold">{yesterday}</dd>
          </div>
          <div>
            <dt className="text-xs text-white/60">Ticket médio hoje</dt>
            <dd className="tabular mt-0.5 font-heading text-lg font-semibold">{averageTicket}</dd>
          </div>
        </dl>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}
