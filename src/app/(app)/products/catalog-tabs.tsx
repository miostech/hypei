import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AppDictionary } from "@/lib/i18n/app";

export type CatalogTab = "mine" | "affiliations";

/**
 * As duas listas de produtos de quem usa a Kabrun: os que ela vende e os que ela divulga.
 *
 * São páginas diferentes porque uma é da organização e a outra é da pessoa, mas quem olha vê
 * uma coisa só — "meus produtos" —, então as abas atravessam as duas rotas.
 */
const TABS: { tab: CatalogTab; href: Route }[] = [
  { tab: "mine", href: "/products" },
  // A coprodução entra aqui quando existir: é a terceira forma de a pessoa ter parte em um
  // produto, ao lado de vender o seu e divulgar o de outro.
  { tab: "affiliations", href: "/affiliations" },
];

export function CatalogTabs({ active, dict }: { active: CatalogTab; dict: AppDictionary }) {
  const labels: Record<CatalogTab, string> = { mine: dict.products.mine, affiliations: dict.affiliations.title };

  return (
    <nav className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-muted p-1">
      {TABS.map(({ tab, href }) => (
        <Button
          key={tab}
          size="sm"
          variant={tab === active ? "default" : "ghost"}
          className="h-8 shrink-0 rounded-lg px-3"
          render={<Link href={href} aria-current={tab === active ? "page" : undefined} />}
        >
          {labels[tab]}
        </Button>
      ))}
    </nav>
  );
}
