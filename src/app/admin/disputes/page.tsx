import { ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { getServices } from "@/server/container";
import { DISPUTE_BADGE } from "../status-badges";

export const metadata = { title: "Disputas · Admin" };

export default async function AdminDisputesPage() {
  const disputes = await getServices().platformAdmin.listDisputes(false);
  const open = disputes.filter((dispute) => dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW");

  return (
    <>
      <PageHeader
        title="Disputas"
        description={`${open.length} em aberto. O valor contestado fica retido na organização até a resolução.`}
      />

      {disputes.length === 0 ? (
        <EmptyState icon={ShieldCheckIcon} title="Nenhuma disputa" description="Nenhuma cobrança foi contestada na plataforma." />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Prazo para provas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Retido</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((dispute) => {
                  const badge = DISPUTE_BADGE[dispute.status] ?? { label: dispute.status, variant: "outline" as const };
                  return (
                    <TableRow key={dispute.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(dispute.createdAt)}</TableCell>
                      <TableCell>
                        <Link href={`/admin/organizations/${dispute.organizationId}`} className="font-medium hover:underline">
                          {dispute.organizationName}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {dispute.evidenceDueAt ? formatDateTime(dispute.evidenceDueAt) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="tabular text-right text-muted-foreground">
                        {formatAmount(dispute.heldAmount, dispute.currency)}
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">{formatAmount(dispute.amount, dispute.currency)}</TableCell>
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
