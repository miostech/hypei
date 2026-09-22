import { PlusIcon, TagIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount } from "@/lib/ui/format";
import { BILLING_TYPE_LABELS } from "@/modules/offers/offer.schemas";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";

export const metadata = { title: "Ofertas" };

export default async function OffersPage() {
  const { organization } = await requirePagePermission("products:read");
  const services = getServices();
  const [offers, products] = await Promise.all([services.offers.list(organization.id), services.products.list(organization.id)]);

  if (products.length === 0) {
    return (
      <>
        <PageHeader title="Ofertas" description="Preços e formas de cobrança dos seus produtos." />
        <EmptyState
          icon={TagIcon}
          title="Crie um produto primeiro"
          description="Ofertas pertencem a um produto. Cadastre o produto e depois defina o preço."
          action={<Button render={<Link href="/products/new" />}>Criar produto</Button>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Ofertas"
        description="O preço oficial de cada venda vem daqui — nunca da configuração visual do checkout."
        actions={
          <Button render={<Link href="/offers/new" />}>
            <PlusIcon />
            Nova oferta
          </Button>
        }
      />

      {offers.length === 0 ? (
        <EmptyState
          icon={TagIcon}
          title="Nenhuma oferta criada"
          description="Defina o preço e a forma de cobrança do seu produto."
          action={<Button render={<Link href="/offers/new" />}>Criar oferta</Button>}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Oferta</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Cobrança</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((offer) => (
                  <TableRow key={offer.id}>
                    <TableCell>
                      <Link href={`/offers/${offer.id}`} className="font-medium hover:underline">
                        {offer.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{offer.product.name}</TableCell>
                    <TableCell className="text-muted-foreground">{BILLING_TYPE_LABELS[offer.billingType]}</TableCell>
                    <TableCell>
                      <Badge variant={offer.active ? "success" : "secondary"}>{offer.active ? "Ativa" : "Inativa"}</Badge>
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">{formatAmount(offer.amount, offer.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
