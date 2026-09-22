import { RepeatIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDate } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";

export const metadata = { title: "Assinaturas" };

export default async function SubscriptionsPage() {
  const { organization } = await requirePagePermission("sales:read");
  const subscriptions = await getServices().subscriptions.list(organization.id);

  return (
    <>
      <PageHeader
        title="Assinaturas"
        description="O status vem sempre dos eventos do provedor de pagamento, nunca de um retorno do navegador."
      />
      {subscriptions.length === 0 ? (
        <EmptyState
          icon={RepeatIcon}
          title="Nenhuma assinatura ativa"
          description="Crie uma oferta recorrente para começar a vender assinaturas. A cobrança recorrente entra na próxima fase."
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assinatura</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Período atual</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell className="font-medium">{subscription.id.slice(0, 12)}</TableCell>
                    <TableCell>
                      <Badge variant={subscription.status === "ACTIVE" ? "success" : "warning"}>{subscription.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {subscription.currentPeriodEnd ? `até ${formatDate(subscription.currentPeriodEnd)}` : "—"}
                    </TableCell>
                    <TableCell className="tabular text-right">{formatAmount(subscription.amount, subscription.currency)}</TableCell>
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
