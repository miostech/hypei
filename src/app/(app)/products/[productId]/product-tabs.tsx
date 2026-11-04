import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AppDictionary } from "@/lib/i18n/app";

export const PRODUCT_TABS = ["geral", "checkout", "afiliados", "links"] as const;
export type ProductTab = (typeof PRODUCT_TABS)[number];

/** O nome na URL é fixo em português, como nas outras rotas; o rótulo é que segue o idioma. */
const LABEL_KEYS: Record<ProductTab, keyof AppDictionary["productForm"]["tabs"]> = {
  geral: "general",
  checkout: "checkout",
  afiliados: "affiliates",
  links: "links",
};

/**
 * A aba aberta vive na URL, não no navegador.
 *
 * Assim cada aba busca só o que ela mostra, o link pode ser colado para outra pessoa e o botão
 * de voltar faz o que se espera. Nome fora da lista cai na primeira aba em vez de dar erro.
 */
export function resolveProductTab(value: string | string[] | undefined): ProductTab {
  return PRODUCT_TABS.find((tab) => tab === value) ?? "geral";
}

export function ProductTabs({
  productId,
  active,
  labels,
}: {
  productId: string;
  active: ProductTab;
  labels: AppDictionary["productForm"]["tabs"];
}) {
  return (
    <nav className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-muted p-1">
      {PRODUCT_TABS.map((tab) => (
        <Button
          key={tab}
          size="sm"
          variant={tab === active ? "default" : "ghost"}
          className="h-8 shrink-0 rounded-lg px-3"
          render={<Link href={`/products/${productId}?aba=${tab}`} aria-current={tab === active ? "page" : undefined} />}
        >
          {labels[LABEL_KEYS[tab]]}
        </Button>
      ))}
    </nav>
  );
}
