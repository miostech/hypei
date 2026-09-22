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
import { PRODUCT_STATUS_LABELS, PRODUCT_TYPE_LABELS } from "@/modules/products/product.schemas";
import { getServices } from "@/server/container";

export const metadata = { title: "Produtos" };

export default async function ProductsPage() {
  const { organization } = await requirePagePermission("products:read");
  const products = await getServices().products.list(organization.id);

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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ofertas</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Link href={`/products/${product.id}`} className="font-medium hover:underline">
                        {product.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">/{product.slug}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{PRODUCT_TYPE_LABELS[product.type]}</TableCell>
                    <TableCell>
                      <Badge variant={product.status === "ACTIVE" ? "success" : product.status === "DRAFT" ? "outline" : "secondary"}>
                        {PRODUCT_STATUS_LABELS[product.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground">{product._count.offers}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(product.createdAt)}</TableCell>
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
