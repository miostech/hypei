import { PackageIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { DELIVERY_ISSUE_LABELS, PRODUCT_STATUS_LABELS, PRODUCT_TYPE_LABELS } from "@/modules/products/product.schemas";
import { getServices } from "@/server/container";

export const metadata = { title: "Produtos" };

export default async function ProductsPage() {
  const { organization } = await requirePagePermission("products:read");
  const services = getServices();
  const [products, delivery] = await Promise.all([services.products.list(organization.id), services.products.deliveryByProduct(organization.id)]);

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Cursos, comunidades, mentorias e outros produtos digitais."
        actions={
          <Button render={<Link href="/products/new" />}>
            <PlusIcon />
            Novo produto
          </Button>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          icon={PackageIcon}
          title="Nenhum produto cadastrado"
          description="Comece criando o produto que você vai vender. Depois defina ofertas com preços."
          action={
            <Button render={<Link href="/products/new" />}>
              <PlusIcon />
              Criar produto
            </Button>
          }
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Ofertas</TableHead>
                  <TableHead className="hidden md:table-cell">Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  // Arquivado não vende, então não há entrega para avisar.
                  const content = delivery.get(product.id);
                  const issue = product.status !== "ARCHIVED" && content && !content.ready ? content.reason : null;

                  return (
                  <TableRow key={product.id}>
                    <TableCell className="max-w-[52vw] sm:max-w-none">
                      <Link href={`/products/${product.id}`} className="block truncate font-medium hover:underline">
                        {product.name}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">/{product.slug}</span>
                      <span className="block text-xs text-muted-foreground lg:hidden">
                        {PRODUCT_TYPE_LABELS[product.type]} · {product._count.offers} oferta(s)
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{PRODUCT_TYPE_LABELS[product.type]}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={product.status === "ACTIVE" ? "success" : product.status === "DRAFT" ? "outline" : "secondary"}>
                          {PRODUCT_STATUS_LABELS[product.status]}
                        </Badge>
                        {issue && <Badge variant="warning">{DELIVERY_ISSUE_LABELS[issue]}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="tabular hidden text-right text-muted-foreground sm:table-cell">{product._count.offers}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(product.createdAt)}</TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
