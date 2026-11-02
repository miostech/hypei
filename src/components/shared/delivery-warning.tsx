import { AlertTriangleIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ProductDelivery } from "@/modules/products/product-delivery";

const COPY = {
  missing: {
    title: "Este produto não entrega nada",
    description: "Quem comprar vai pagar e não vai receber acesso a nada. Crie o conteúdo antes de divulgar o checkout.",
    action: "Criar conteúdo",
  },
  empty: {
    title: "O conteúdo deste produto está vazio",
    description: "O conteúdo existe, mas não tem nenhuma aula. Quem comprar entra na área de membros e não encontra nada.",
    action: "Adicionar conteúdo",
  },
  unpublished: {
    title: "O conteúdo deste produto não está publicado",
    description: "Enquanto for rascunho, quem comprar não consegue abrir — e o e-mail de confirmação vai sem o link de acesso.",
    action: "Publicar conteúdo",
  },
} as const;

/**
 * Shown wherever a producer could put a product on sale, because nothing stops them from
 * selling a product with no content: the charge goes through and the buyer receives an
 * e-mail with no access link.
 */
export function DeliveryWarning({ delivery, productId }: { delivery: ProductDelivery; productId: string }) {
  if (delivery.ready) return null;

  const copy = COPY[delivery.reason];
  // Typed routes só aceitam o literal: montar o link aqui evita duplicar o botão.
  const target =
    delivery.reason === "missing" ? (
      <Link href={`/members-area/new?productId=${productId}`} />
    ) : (
      <Link href={`/members-area/${delivery.courseId}`} />
    );

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardContent className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
          <AlertTriangleIcon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{copy.title}</p>
          <p className="text-xs text-muted-foreground">{copy.description}</p>
        </div>
        <Button variant="outline" size="sm" render={target}>
          {copy.action}
        </Button>
      </CardContent>
    </Card>
  );
}
