import type { ReactNode } from "react";
import { cn } from "cn";
import type { AppDictionary } from "@/lib/i18n/app";

/**
 * The producer's money, front and centre: deep purple gradient with the gold bolt
 * as a watermark. Amounts arrive already formatted (money never crosses as bigint).
 *
 * O número grande é o que a tela quer que ela veja primeiro — o saldo, nos saques; o quanto
 * ela já vendeu, no financeiro —, e por isso vem com o rótulo junto.
 */
export function BalanceHero({
  dict,
  currency,
  label,
  amount,
  pending,
  reserved,
  footnote,
  actions,
  className,
}: {
  dict: AppDictionary;
  currency: string;
  /** Padrão: "Saldo disponível". */
  label?: string;
  amount: string;
  /** Os dois valores de apoio são opcionais: há tela que mostra cada um no seu próprio card. */
  pending?: string;
  reserved?: string;
  footnote?: string;
  actions?: ReactNode;
  className?: string;
}) {
  const t = dict.balance;

  return (
    <section
      className={cn(
        "bg-brand-gradient relative isolate overflow-hidden rounded-2xl p-6 text-white shadow-lift sm:p-7",
        className,
      )}
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
            {label ?? t.available}
            <span className="rounded-full bg-white/12 px-1.5 py-0.5 text-[0.65rem] tracking-normal text-white/80">{currency}</span>
          </p>
          <p className="tabular mt-2 font-heading text-4xl leading-none font-extrabold sm:text-5xl">{amount}</p>
          {footnote && <p className="mt-2.5 max-w-md text-sm text-white/70">{footnote}</p>}
        </div>

        {(pending || reserved) && (
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            {pending && (
              <div>
                <dt className="text-xs text-white/60">{t.pending}</dt>
                <dd className="tabular mt-0.5 font-heading text-lg font-semibold">{pending}</dd>
              </div>
            )}
            {reserved && (
              <div>
                <dt className="text-xs text-white/60">{t.reserved}</dt>
                <dd className="tabular mt-0.5 font-heading text-lg font-semibold">{reserved}</dd>
              </div>
            )}
          </dl>
        )}

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}
