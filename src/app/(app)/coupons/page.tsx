import { PowerIcon, TicketIcon, Trash2Icon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Metadata } from "next";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill, plural } from "@/lib/i18n/locale";
import { formatAmount, formatDate } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { getServices } from "@/server/container";
import { deleteCoupon, setCouponActive } from "./actions";
import { CouponDialog, type CouponValues } from "./coupon-dialog";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAppDictionary(await appLocale());
  return { title: dict.coupons.title };
}

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
  const dict = await getAppDictionary(await appLocale());
  const t = dict.coupons;

  /** O selo do cupom: inativo, vencido, esgotado ou ativo — nessa ordem de prioridade. */
  const statusLabel = (active: boolean, expired: boolean, exhausted: boolean) =>
    !active ? t.statuses.inactive : expired ? t.statuses.expired : exhausted ? t.statuses.exhausted : t.statuses.active;

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={canEdit && <CouponDialog products={productOptions} currency={organization.defaultCurrency} />}
      />

      {coupons.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title={t.emptyTitle}
          description={t.emptyBody}
          action={canEdit ? <CouponDialog products={productOptions} currency={organization.defaultCurrency} /> : undefined}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.code}</TableHead>
                  <TableHead>{t.discount}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t.appliesTo}</TableHead>
                  <TableHead className="hidden md:table-cell">{t.uses}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t.validity}</TableHead>
                  <TableHead className="hidden sm:table-cell">{dict.common.status}</TableHead>
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
                      <TableCell className="max-w-[38vw] sm:max-w-none">
                        <span className="block truncate font-mono text-sm font-semibold">{coupon.code}</span>
                        {coupon.oncePerCustomer && <span className="block text-xs text-muted-foreground">{t.oncePerCustomer}</span>}
                        <span className="block text-xs text-muted-foreground md:hidden">
                          {coupon.maxRedemptions !== null
                            ? `${coupon.redemptions} / ${coupon.maxRedemptions}`
                            : plural(dict.locale, coupon.redemptions, t.useCount)}
                        </span>
                        <span className="mt-1 block sm:hidden">
                          <Badge variant={coupon.active && !expired && !exhausted ? "success" : "outline"}>
                            {statusLabel(coupon.active, expired, exhausted)}
                          </Badge>
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {coupon.type === "PERCENTAGE"
                          ? `${(coupon.percentageBps ?? 0) / 100}%`
                          : formatAmount(coupon.amount ?? 0n, coupon.currency ?? organization.defaultCurrency)}
                        {coupon.minAmount !== null && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {fill(t.above, { amount: formatAmount(coupon.minAmount, coupon.currency ?? organization.defaultCurrency) })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{coupon.product?.name ?? t.allProducts}</TableCell>
                      <TableCell className="tabular hidden text-muted-foreground md:table-cell">
                        {coupon.redemptions}
                        {coupon.maxRedemptions !== null ? ` / ${coupon.maxRedemptions}` : ""}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                        {coupon.expiresAt ? formatDate(coupon.expiresAt, dict.localeTag) : t.noExpiry}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={coupon.active && !expired && !exhausted ? "success" : "outline"}>
                          {statusLabel(coupon.active, expired, exhausted)}
                        </Badge>
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
                                aria-label={fill(coupon.active ? t.deactivate : t.activate, { code: coupon.code })}
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
                                  aria-label={fill(t.delete, { code: coupon.code })}
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
