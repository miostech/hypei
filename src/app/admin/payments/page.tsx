import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { getServices } from "@/server/container";
import { PAYMENT_BADGE } from "../status-badges";

export const metadata = { title: "Pagamentos · Admin" };

export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : undefined;
  const payments = await getServices().platformAdmin.searchPayments(query);

  return (
    <>
      <PageHeader
        title="Pagamentos"
        description="Busca por id do pagamento, id do pedido, id no provedor ou e-mail do cliente — em todas as organizações."
      />

      <form className="flex gap-2">
        <Input name="q" defaultValue={query} placeholder="cmul… ou cliente@example.com" aria-label="Buscar pagamentos" />
        <Button type="submit" variant="outline">
          <SearchIcon />
          Buscar
        </Button>
      </form>

      {payments.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title="Nenhum pagamento encontrado"
          description={query ? "Nada corresponde a essa busca." : "Ainda não há pagamentos na plataforma."}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const badge = PAYMENT_BADGE[payment.status] ?? { label: payment.status, variant: "outline" as const };
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(payment.createdAt)}</TableCell>
                      <TableCell>
                        <Link href={`/admin/organizations/${payment.organizationId}`} className="font-medium hover:underline">
                          {payment.organizationName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{payment.customerEmail}</TableCell>
                      <TableCell>
                        <span className="block text-xs text-muted-foreground">{payment.provider}</span>
                        <span className="font-mono text-xs">{payment.providerPaymentId?.slice(-12) ?? "—"}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">{formatAmount(payment.amount, payment.currency)}</TableCell>
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
