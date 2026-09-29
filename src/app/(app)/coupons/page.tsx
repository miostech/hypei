import { PowerIcon, TicketIcon, Trash2Icon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmount, formatDate } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { getServices } from "@/server/container";
import { deleteCoupon, setCouponActive } from "./actions";
import { CouponDialog, type CouponValues } from "./coupon-dialog";

export const metadata = { title: "Cupons" };

/** Minor units back to the decimal string the form expects ("5000" → "50,00"). */
function toDecimal(value: bigint | null): string {
  if (value === null) return "";
  return (Number(value) / 100).toFixed(2).replace(".", ",");
}

export default async function CouponsPage() {
  const { organization, membership } = await requirePagePermission("products:read");
  const services = getServices();
  const [coupons, products] = await Promise.all([
    services.coupons.list(organization.id),
    services.products.list(organization.id),
  ]);
  const canEdit = hasPermission(membership.role, "products:write");
  const productOptions = products.map((product) => ({ id: product.id, name: product.name }));
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Cupons"
        description="Descontos que o cliente digita no checkout."
        actions={canEdit && <CouponDialog products={productOptions} currency={organization.defaultCurrency} />}
      />

      {coupons.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title="Nenhum cupom criado"
          description="Crie um cupom para lançamentos, campanhas ou para recuperar quem desistiu da compra."
          action={canEdit ? <CouponDialog products={productOptions} currency={organization.defaultCurrency} /> : undefined}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Aplica em</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="w-px" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => {
                  const expired = coupon.expiresAt !== null && coupon.expiresAt <= now;
                  const exhausted = coupon.maxRedemptions !== null && coupon.redemptions >= coupon.maxRedemptions;
                  const values: CouponValues = {
                    id: coupon.id,
                    code: coupon.code,
                    type: coupon.type,
                    percentage: coupon.percentageBps ? (coupon.percentageBps / 100).toString().replace(".", ",") : "",
                    amount: toDecimal(coupon.amount),
                    minAmount: toDecimal(coupon.minAmount),
                    productId: coupon.productId,
                    maxRedemptions: coupon.maxRedemptions?.toString() ?? "",
                    oncePerCustomer: coupon.oncePerCustomer,
                    expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString().slice(0, 10) : "",
                    active: coupon.active,
                  };

                  return (
                    <TableRow key={coupon.id}>
                      <TableCell>
                        <span className="font-mono text-sm font-semibold">{coupon.code}</span>
                        {coupon.oncePerCustomer && <span className="block text-xs text-muted-foreground">Uma vez por cliente</span>}
                      </TableCell>
                      <TableCell className="font-medium">
                        {coupon.type === "PERCENTAGE"
                          ? `${(coupon.percentageBps ?? 0) / 100}%`
                          : formatAmount(coupon.amount ?? 0n, coupon.currency ?? organization.defaultCurrency)}
                        {coupon.minAmount !== null && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            acima de {formatAmount(coupon.minAmount, coupon.currency ?? organization.defaultCurrency)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{coupon.product?.name ?? "Todos os produtos"}</TableCell>
                      <TableCell className="tabular text-muted-foreground">
                        {coupon.redemptions}
                        {coupon.maxRedemptions !== null ? ` / ${coupon.maxRedemptions}` : ""}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {coupon.expiresAt ? formatDate(coupon.expiresAt) : "Sem validade"}
                      </TableCell>
                      <TableCell>
                        {!coupon.active ? (
                          <Badge variant="outline">Inativo</Badge>
                        ) : expired ? (
                          <Badge variant="outline">Expirado</Badge>
                        ) : exhausted ? (
                          <Badge variant="outline">Esgotado</Badge>
                        ) : (
                          <Badge variant="success">Ativo</Badge>
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center justify-end gap-0.5">
                            <CouponDialog coupon={values} products={productOptions} currency={organization.defaultCurrency} />
                            <form action={setCouponActive}>
                              <input type="hidden" name="couponId" value={coupon.id} />
                              <input type="hidden" name="active" value={coupon.active ? "false" : "true"} />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={coupon.active ? `Desativar ${coupon.code}` : `Ativar ${coupon.code}`}
                              >
                                <PowerIcon />
                              </Button>
                            </form>
                            {coupon.redemptions === 0 && (
                              <form action={deleteCoupon}>
                                <input type="hidden" name="couponId" value={coupon.id} />
                                <Button
                                  type="submit"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Excluir ${coupon.code}`}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2Icon />
                                </Button>
                              </form>
                            )}
                          </div>
                        </TableCell>
                      )}
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
