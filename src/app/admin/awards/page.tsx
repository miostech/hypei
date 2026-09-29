import { GiftIcon } from "lucide-react";
import Link from "next/link";
import { AwardMedal } from "@/components/awards/award-medal";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompactAmount, formatDate } from "@/lib/ui/format";
import { AWARD_TIER_BY_NAME } from "@/modules/awards/award.tiers";
import { getServices } from "@/server/container";
import { ShipAwardDialog } from "./ship-dialog";

export const metadata = { title: "Premiações · Admin" };

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "outline" }> = {
  ACHIEVED: { label: "A enviar", variant: "warning" },
  SHIPPED: { label: "Enviado", variant: "success" },
  DELIVERED: { label: "Entregue", variant: "success" },
};

export default async function AdminAwardsPage() {
  const awards = await getServices().awards.listAll();
  const toShip = awards.filter((award) => award.status === "ACHIEVED");

  return (
    <>
      <PageHeader title="Premiações" description="Placas conquistadas pelos produtores e o que ainda precisa ser enviado." />

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard label="A enviar" value={String(toShip.length)} tone={toShip.length > 0 ? "warning" : "muted"} />
        <StatCard label="Conquistadas" value={String(awards.length)} hint="Desde o início" />
      </section>

      {awards.length === 0 ? (
        <EmptyState
          icon={GiftIcon}
          title="Nenhuma premiação ainda"
          description="Assim que um produtor cruzar a primeira meta de faturamento líquido, ela aparece aqui."
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conquistada</TableHead>
                  <TableHead>Produtor</TableHead>
                  <TableHead>Premiação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rastreio</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {awards.map((award) => {
                  const badge = STATUS[award.status];
                  const tier = AWARD_TIER_BY_NAME.get(award.tier);
                  return (
                    <TableRow key={award.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(award.achievedAt)}</TableCell>
                      <TableCell>
                        <Link href={`/admin/organizations/${award.organizationId}`} className="font-medium hover:underline">
                          {award.organization.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2 font-medium">
                          <AwardMedal tier={award.tier} className="size-6" />
                          {formatCompactAmount(award.threshold, award.currency)}
                          <span className="text-xs font-normal text-muted-foreground">{tier?.label}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{award.trackingCode ?? "—"}</TableCell>
                      <TableCell>
                        {award.status === "ACHIEVED" && (
                          <ShipAwardDialog
                            awardId={award.id}
                            organizationName={award.organization.name}
                            tierLabel={tier?.label ?? award.tier}
                          />
                        )}
                      </TableCell>
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
