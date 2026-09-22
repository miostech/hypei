import { UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";

export const metadata = { title: "Clientes" };

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const { organization } = await requirePagePermission("customers:read");
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : undefined;
  const customers = await getServices().uow.repos.customers.list(organization.id, { search, limit: 100 });

  return (
    <>
      <PageHeader title="Clientes" description="Quem comprou de você. O cliente pertence à sua organização, não à plataforma." />

      <form className="max-w-sm">
        <Input name="q" defaultValue={search} placeholder="Buscar por nome ou e-mail…" aria-label="Buscar clientes" />
      </form>

      {customers.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={search ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
          description={search ? "Tente outro termo de busca." : "Os compradores aparecem aqui assim que iniciam uma compra."}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Pedidos</TableHead>
                  <TableHead>Desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <span className="font-medium">{customer.name}</span>
                      <span className="block text-xs text-muted-foreground">{customer.email}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{customer.country ?? "—"}</TableCell>
                    <TableCell className="tabular text-muted-foreground">{customer._count.orders}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(customer.createdAt)}</TableCell>
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
