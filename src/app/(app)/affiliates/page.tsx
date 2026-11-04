import { LinkIcon, PowerIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getEnv } from "@/lib/env";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill } from "@/lib/i18n/locale";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { getServices } from "@/server/container";
import { setAffiliateActive } from "./actions";
import { AffiliateDialog, type AffiliateValues } from "./affiliate-dialog";
import { CopyLink } from "./copy-link";
import { PayAffiliateButton } from "./pay-affiliate-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).affiliates.title };
}

export default async function AffiliatesPage() {
  const { organization, membership } = await requirePagePermission("sales:read");
  const services = getServices();
  const [affiliates, totals, commissions, products] = await Promise.all([
    services.affiliates.list(organization.id),
    services.affiliates.totals(organization.id),
    services.affiliates.listCommissions(organization.id, 50),
    services.products.list(organization.id),
  ]);
  const dict = await getAppDictionary(await appLocale());
  const t = dict.affiliates;

  const canEdit = hasPermission(membership.role, "products:write");
  const canPay = hasPermission(membership.role, "finance:read");
  const currency = organization.defaultCurrency;
  const appUrl = getEnv().APP_URL;
  const byAffiliate = new Map(totals.map((entry) => [entry.affiliateId, entry]));

  const sum = (key: "pending" | "available" | "paid") => totals.reduce((total, entry) => total + entry[key], 0n);
  const productOptions = products.map((product) => ({ id: product.id, name: product.name }));

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={canEdit && <AffiliateDialog products={productOptions} />}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t.pendingCommission} value={formatAmount(sum("pending"), currency)} hint={t.pendingHint} />
        <StatCard label={t.payable} value={formatAmount(sum("available"), currency)} tone={sum("available") > 0n ? "warning" : "muted"} />
        <StatCard label={t.paid} value={formatAmount(sum("paid"), currency)} tone="positive" />
      </section>

      {affiliates.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={t.emptyTitle}
          description={t.emptyBody}
          action={canEdit ? <AffiliateDialog products={productOptions} /> : undefined}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.affiliate}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t.commission}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t.link}</TableHead>
                  <TableHead className="hidden text-right xl:table-cell">{t.sales}</TableHead>
                  <TableHead className="text-right">{t.payable}</TableHead>
                  <TableHead className="hidden md:table-cell">{dict.common.status}</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliates.map((affiliate) => {
                  const entry = byAffiliate.get(affiliate.id);
                  // Uma pessoa pode estar afiliada a vários produtos; a tabela mostra o
                  // primeiro e o contador diz quantos são, para a linha não virar uma lista.
                  const affiliation = affiliate.affiliations[0];
                  const url = affiliation ? `${appUrl}/r/${affiliation.code}` : null;
                  const values: AffiliateValues = {
                    id: affiliate.id,
                    name: affiliate.name,
                    email: affiliate.email,
                    commission: (affiliate.commissionBps / 100).toString().replace(".", ","),
                  };

                  return (
                    <TableRow key={affiliate.id}>
                      <TableCell className="max-w-[46vw] sm:max-w-none">
                        <span className="block truncate font-medium">{affiliate.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{affiliate.email}</span>
                        <span className="block text-xs text-muted-foreground sm:hidden">
                          {fill(t.commissionOf, { percent: affiliate.commissionBps / 100 })}
                        </span>
                        <span className="mt-1 block md:hidden">
                          {affiliate.active ? <Badge variant="success">{t.active}</Badge> : <Badge variant="outline">{t.inactive}</Badge>}
                        </span>
                      </TableCell>
                      <TableCell className="hidden font-medium sm:table-cell">{affiliate.commissionBps / 100}%</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {url ? (
                          <CopyLink url={url} label={affiliate.name} />
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <LinkIcon className="size-3.5" aria-hidden />
                            {fill(t.code, { code: affiliation?.code ?? "—" })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="tabular hidden text-right text-muted-foreground xl:table-cell">{entry?.sales ?? 0}</TableCell>
                      <TableCell className="tabular text-right font-medium">{formatAmount(entry?.available ?? 0n, currency)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {affiliate.active ? <Badge variant="success">{t.active}</Badge> : <Badge variant="outline">{t.inactive}</Badge>}
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
                              <AffiliateDialog affiliate={values} products={productOptions} />
                              <form action={setAffiliateActive}>
                                <input type="hidden" name="affiliateId" value={affiliate.id} />
                                <input type="hidden" name="active" value={affiliate.active ? "false" : "true"} />
                                <Button
                                  type="submit"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={fill(affiliate.active ? t.deactivate : t.activate, { name: affiliate.name })}
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
            <CardTitle>{t.commissionsTitle}</CardTitle>
            <CardDescription>{t.commissionsDescription}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">{dict.common.date}</TableHead>
                  <TableHead>{t.affiliate}</TableHead>
                  <TableHead className="hidden lg:table-cell">{dict.common.customer}</TableHead>
                  <TableHead className="hidden lg:table-cell">{dict.common.product}</TableHead>
                  <TableHead className="hidden sm:table-cell">{dict.common.status}</TableHead>
                  <TableHead className="text-right">{t.commission}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((commission) => {
                  const net = commission.amount - commission.reversedAmount;
                  return (
                    <TableRow key={commission.id}>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                        {formatDateTime(commission.createdAt, dict.localeTag)}
                      </TableCell>
                      <TableCell className="max-w-[46vw] sm:max-w-none">
                        <span className="block truncate font-medium">{commission.affiliate.name}</span>
                        <span className="block truncate text-xs text-muted-foreground lg:hidden">
                          {commission.order.customer.name} · {commission.order.items[0]?.productName ?? "—"}
                        </span>
                        <span className="block text-xs text-muted-foreground md:hidden">
                          {formatDateTime(commission.createdAt, dict.localeTag)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{commission.order.customer.name}</TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{commission.order.items[0]?.productName ?? "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge
                          variant={
                            commission.status === "PAID"
                              ? "success"
                              : commission.status === "AVAILABLE"
                                ? "warning"
                                : "outline"
                          }
                        >
                          {t.statuses[commission.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">
                        {formatAmount(net, commission.currency)}
                        {commission.reversedAmount > 0n && commission.status !== "CANCELED" && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {fill(t.reversed, { amount: formatAmount(commission.reversedAmount, commission.currency) })}
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
