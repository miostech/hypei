import { BuildingIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/ui/format";
import { getServices } from "@/server/container";
import { VERIFICATION_BADGE } from "../status-badges";

export const metadata = { title: "Organizações · Admin" };

export default async function AdminOrganizationsPage({ searchParams }: PageProps<"/admin/organizations">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : undefined;
  const organizations = await getServices().platformAdmin.listOrganizations(query);

  return (
    <>
      <PageHeader title="Organizações" description="Todos os produtores da plataforma." />

      <form className="flex gap-2">
        <Input name="q" defaultValue={query} placeholder="Buscar por nome, link ou razão social…" aria-label="Buscar organizações" />
        <Button type="submit" variant="outline">
          <SearchIcon />
          Buscar
        </Button>
      </form>

      {organizations.length === 0 ? (
        <EmptyState
          icon={BuildingIcon}
          title="Nenhuma organização encontrada"
          description={query ? "Nenhum produtor corresponde à busca." : "Ainda não há produtores cadastrados."}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Verificação</TableHead>
                  <TableHead>Saques</TableHead>
                  <TableHead className="text-right">Produtos</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead>Desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((organization) => {
                  const badge = VERIFICATION_BADGE[organization.verificationStatus ?? "NOT_STARTED"];
                  return (
                    <TableRow key={organization.id}>
                      <TableCell>
                        <Link href={`/admin/organizations/${organization.id}`} className="font-medium hover:underline">
                          {organization.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">/{organization.slug}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{organization.country}</TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={organization.payoutsEnabled ? "success" : "outline"}>
                          {organization.payoutsEnabled ? "Liberados" : "Bloqueados"}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-right text-muted-foreground">{organization.products}</TableCell>
                      <TableCell className="tabular text-right text-muted-foreground">{organization.orders}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(organization.createdAt)}</TableCell>
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
