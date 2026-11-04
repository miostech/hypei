import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AppDictionary } from "@/lib/i18n/app";

export const FINANCE_TABS = ["movimentacoes", "saques"] as const;
export type FinanceTab = (typeof FINANCE_TABS)[number];

/** O nome na URL é fixo em português, como nas outras rotas; o rótulo é que segue o idioma. */
const LABEL_KEYS: Record<FinanceTab, keyof AppDictionary["finance"]["tabs"]> = {
  movimentacoes: "movements",
  saques: "payouts",
};

/**
 * A aba aberta vive na URL, não no navegador — assim cada aba busca só o que ela mostra e o
 * link pode ser colado para outra pessoa. Nome fora da lista cai na primeira aba, sem erro.
 */
export function resolveFinanceTab(value: string | string[] | undefined): FinanceTab {
  return FINANCE_TABS.find((tab) => tab === value) ?? "movimentacoes";
}

export function FinanceTabs({
  active,
  currency,
  labels,
}: {
  active: FinanceTab;
  /** Vai junto no link: trocar de aba não pode jogá-la de volta para a outra moeda. */
  currency: string;
  labels: AppDictionary["finance"]["tabs"];
}) {
  return (
    <nav className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-muted p-1">
      {FINANCE_TABS.map((tab) => (
        <Button
          key={tab}
          size="sm"
          variant={tab === active ? "default" : "ghost"}
          className="h-8 shrink-0 rounded-lg px-3"
          render={<Link href={`/finance?aba=${tab}&currency=${currency}`} aria-current={tab === active ? "page" : undefined} />}
        >
          {labels[LABEL_KEYS[tab]]}
        </Button>
      ))}
    </nav>
  );
}
