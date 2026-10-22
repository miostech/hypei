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
                  <TableHead className="hidden sm:table-cell">País</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="hidden md:table-cell">Desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="max-w-[60vw] sm:max-w-none">
                      <span className="block truncate font-medium">{customer.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{customer.email}</span>
                      <span className="block text-xs text-muted-foreground md:hidden">desde {formatDate(customer.createdAt)}</span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{customer.country ?? "—"}</TableCell>
                    <TableCell className="tabular text-right text-muted-foreground">{customer._count.orders}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(customer.createdAt)}</TableCell>
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
