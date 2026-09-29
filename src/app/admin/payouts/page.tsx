import { BanknoteIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { getServices } from "@/server/container";
import { PAYOUT_BADGE } from "../status-badges";

export const metadata = { title: "Saques · Admin" };

export default async function AdminPayoutsPage() {
  const payouts = await getServices().platformAdmin.listPayouts();

  return (
    <>
      <PageHeader title="Saques" description="Fila de saques de todas as organizações, do mais recente ao mais antigo." />

      {payouts.length === 0 ? (
        <EmptyState icon={BanknoteIcon} title="Nenhum saque" description="Nenhum produtor solicitou saque até agora." />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Solicitado</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => {
                  const badge = PAYOUT_BADGE[payout.status] ?? { label: payout.status, variant: "outline" as const };
                  return (
                    <TableRow key={payout.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(payout.requestedAt)}</TableCell>
                      <TableCell>
                        <Link href={`/admin/organizations/${payout.organizationId}`} className="font-medium hover:underline">
                          {payout.organizationName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                        {payout.failureReason && <span className="block text-xs text-destructive">{payout.failureReason}</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {payout.paidAt ? formatDateTime(payout.paidAt) : "—"}
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">{formatAmount(payout.amount, payout.currency)}</TableCell>
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
