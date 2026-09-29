import { LinkIcon, PowerIcon, UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getEnv } from "@/lib/env";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { AFFILIATE_COMMISSION_STATUS_LABELS } from "@/modules/affiliates/affiliate.schemas";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { getServices } from "@/server/container";
import { setAffiliateActive } from "./actions";
import { AffiliateDialog, type AffiliateValues } from "./affiliate-dialog";
import { CopyLink } from "./copy-link";
import { PayAffiliateButton } from "./pay-affiliate-button";

export const metadata = { title: "Afiliados" };

export default async function AffiliatesPage() {
  const { organization, membership } = await requirePagePermission("sales:read");
  const services = getServices();
  const [affiliates, totals, commissions, checkouts] = await Promise.all([
    services.affiliates.list(organization.id),
    services.affiliates.totals(organization.id),
    services.affiliates.listCommissions(organization.id, 50),
    services.checkouts.list(organization.id),
  ]);

  const canEdit = hasPermission(membership.role, "products:write");
  const canPay = hasPermission(membership.role, "finance:read");
  const currency = organization.defaultCurrency;
  const appUrl = getEnv().APP_URL;
  const byAffiliate = new Map(totals.map((entry) => [entry.affiliateId, entry]));

  const sum = (key: "pending" | "available" | "paid") => totals.reduce((total, entry) => total + entry[key], 0n);
  const checkoutOptions = checkouts.map((checkout) => ({ id: checkout.id, name: checkout.name }));

  return (
    <>
      <PageHeader
        title="Afiliados"
        description="Parceiros que vendem para você e ganham comissão por venda indicada."
        actions={canEdit && <AffiliateDialog checkouts={checkoutOptions} />}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Comissão a liberar" value={formatAmount(sum("pending"), currency)} hint="Vendas ainda no prazo de liberação" />
        <StatCard label="A pagar" value={formatAmount(sum("available"), currency)} tone={sum("available") > 0n ? "warning" : "muted"} />
        <StatCard label="Já pago" value={formatAmount(sum("paid"), currency)} tone="positive" />
      </section>

      {affiliates.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Nenhum afiliado cadastrado"
          description="Cadastre um parceiro, envie o link dele e a comissão é calculada automaticamente em cada venda indicada."
          action={canEdit ? <AffiliateDialog checkouts={checkoutOptions} /> : undefined}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Afiliado</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">A pagar</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliates.map((affiliate) => {
                  const entry = byAffiliate.get(affiliate.id);
                  const link = affiliate.links[0];
                  const url = link?.checkout
                    ? `${appUrl}/checkout/${link.checkout.slug}?ref=${link.code}`
                    : null;
                  const values: AffiliateValues = {
                    id: affiliate.id,
                    name: affiliate.name,
                    email: affiliate.email,
                    commission: (affiliate.commissionBps / 100).toString().replace(".", ","),
                  };

                  return (
                    <TableRow key={affiliate.id}>
                      <TableCell>
                        <span className="font-medium">{affiliate.name}</span>
                        <span className="block text-xs text-muted-foreground">{affiliate.email}</span>
                      </TableCell>
                      <TableCell className="font-medium">{affiliate.commissionBps / 100}%</TableCell>
                      <TableCell>
                        {url ? (
                          <CopyLink url={url} label={affiliate.name} />
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <LinkIcon className="size-3.5" aria-hidden />
                            código {link?.code ?? "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="tabular text-right text-muted-foreground">{entry?.sales ?? 0}</TableCell>
                      <TableCell className="tabular text-right font-medium">{formatAmount(entry?.available ?? 0n, currency)}</TableCell>
                      <TableCell>
                        {affiliate.active ? <Badge variant="success">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          {canPay && (entry?.available ?? 0n) > 0n && (
                            <PayAffiliateButton
                              affiliateId={affiliate.id}
                              name={affiliate.name}
                              amountLabel={formatAmount(entry?.available ?? 0n, currency)}
                            />
                          )}
                          {canEdit && (
                            <>
                              <AffiliateDialog affiliate={values} checkouts={checkoutOptions} />
                              <form action={setAffiliateActive}>
                                <input type="hidden" name="affiliateId" value={affiliate.id} />
                                <input type="hidden" name="active" value={affiliate.active ? "false" : "true"} />
                                <Button
                                  type="submit"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={affiliate.active ? `Desativar ${affiliate.name}` : `Ativar ${affiliate.name}`}
                                >
                                  <PowerIcon />
                                </Button>
                              </form>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {commissions.length > 0 && (
        <Card className="py-0">
          <CardHeader className="border-b p-5 pb-4">
            <CardTitle>Comissões</CardTitle>
            <CardDescription>
              Cada venda indicada gera uma comissão, que fica reservada e é liberada junto com o seu saldo.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Afiliado</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((commission) => {
                  const net = commission.amount - commission.reversedAmount;
                  return (
                    <TableRow key={commission.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(commission.createdAt)}</TableCell>
                      <TableCell className="font-medium">{commission.affiliate.name}</TableCell>
                      <TableCell className="text-muted-foreground">{commission.order.customer.name}</TableCell>
                      <TableCell className="text-muted-foreground">{commission.order.items[0]?.productName ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            commission.status === "PAID"
                              ? "success"
                              : commission.status === "CANCELED"
                                ? "outline"
                                : commission.status === "AVAILABLE"
                                  ? "warning"
                                  : "outline"
                          }
                        >
                          {AFFILIATE_COMMISSION_STATUS_LABELS[commission.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">
                        {formatAmount(net, commission.currency)}
                        {commission.reversedAmount > 0n && commission.status !== "CANCELED" && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            estornado {formatAmount(commission.reversedAmount, commission.currency)}
                          </span>
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
