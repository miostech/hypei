import { CreditCardIcon, ExternalLinkIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";

export const metadata = { title: "Checkout" };

export default async function CheckoutsPage() {
  const { organization } = await requirePagePermission("products:read");
  const services = getServices();
  const [checkouts, offers] = await Promise.all([services.checkouts.list(organization.id), services.offers.list(organization.id)]);

  if (offers.length === 0) {
    return (
      <>
        <PageHeader title="Checkout" description="Páginas de pagamento das suas ofertas." />
        <EmptyState
          icon={CreditCardIcon}
          title="Crie uma oferta primeiro"
          description="Todo checkout aponta para uma oferta, que define o preço cobrado."
          action={<Button render={<Link href="/offers/new" />}>Criar oferta</Button>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Checkout"
        description="A aparência é versionada: ao salvar, criamos uma nova versão e as vendas antigas mantêm a que o comprador viu."
        actions={
          <Button render={<Link href="/checkouts/new" />}>
            <PlusIcon />
            Novo checkout
          </Button>
        }
      />

      {checkouts.length === 0 ? (
        <EmptyState
          icon={CreditCardIcon}
          title="Nenhum checkout publicado"
          description="Monte a página de pagamento e compartilhe o link para vender."
          action={<Button render={<Link href="/checkouts/new" />}>Criar checkout</Button>}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Checkout</TableHead>
                  <TableHead className="hidden lg:table-cell">Oferta</TableHead>
                  <TableHead className="hidden xl:table-cell">Versão</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkouts.map((checkout) => (
                  <TableRow key={checkout.id}>
                    <TableCell className="max-w-[46vw] sm:max-w-none">
                      <Link href={`/checkouts/${checkout.id}`} className="block truncate font-medium hover:underline">
                        {checkout.name}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">/checkout/{checkout.slug}</span>
                      <span className="block truncate text-xs text-muted-foreground lg:hidden">{checkout.offer.product.name}</span>
                      <Badge className="mt-1 sm:hidden" variant={checkout.status === "ACTIVE" ? "success" : "secondary"}>
                        {checkout.status === "ACTIVE" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{checkout.offer.product.name}</TableCell>
                    <TableCell className="tabular hidden text-muted-foreground xl:table-cell">v{checkout.currentVersion}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={checkout.status === "ACTIVE" ? "success" : "secondary"}>{checkout.status === "ACTIVE" ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="tabular text-right">{formatAmount(checkout.offer.amount, checkout.offer.currency)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" aria-label="Abrir checkout" render={<Link href={`/checkout/${checkout.slug}`} target="_blank" />}>
                        <ExternalLinkIcon />
                      </Button>
                    </TableCell>
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
