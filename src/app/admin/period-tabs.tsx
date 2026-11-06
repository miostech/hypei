import Link from "next/link";
import { ADMIN_PERIOD_LABEL, ADMIN_PERIODS, DEFAULT_ADMIN_PERIOD, type AdminPeriod } from "@/modules/admin/admin-period";

/**
 * O recorte vive na URL, não em estado de componente: assim a operação manda "olha o painel de
 * hoje" por link, o botão de voltar funciona e a página continua inteira no servidor — sem
 * JavaScript para trocar quatro números.
 */
export function AdminPeriodTabs({ active }: { active: AdminPeriod }) {
  return (
    <nav aria-label="Período" className="flex w-fit items-center gap-1 rounded-xl border bg-muted/40 p-1">
      {ADMIN_PERIODS.map((period) => {
        const current = period === active;
        return (
          <Link
            key={period}
            href={period === DEFAULT_ADMIN_PERIOD ? "/admin" : `/admin?periodo=${period}`}
            aria-current={current ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              current ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {ADMIN_PERIOD_LABEL[period]}
          </Link>
        );
      })}
    </nav>
  );
}
