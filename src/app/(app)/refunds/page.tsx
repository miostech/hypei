import { AlertTriangleIcon, RotateCcwIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Metadata } from "next";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { plural } from "@/lib/i18n/locale";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { DISPUTE_STATUS_VARIANT, OPEN_DISPUTE_STATUS, REFUND_STATUS_VARIANT } from "../sales/order-status";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getAppDictionary(await appLocale());
  return { title: dict.refunds.title };
}

export default async function RefundsPage() {
  const { organization } = await requirePagePermission("sales:read");
  const { repos } = getServices().uow;
  const dict = await getAppDictionary(await appLocale());
  const t = dict.refunds;
  const [refunds, disputes] = await Promise.all([
    repos.refunds.listForOrganization(organization.id, 100),
    repos.disputes.listForOrganization(organization.id, 100),
  ]);

  const currency = organization.defaultCurrency;
  const openDisputes = disputes.filter((dispute) => OPEN_DISPUTE_STATUS.includes(dispute.status));
  const heldAmount = openDisputes.reduce((total, dispute) => total + dispute.heldAmount, 0n);
  const refundedAmount = refunds.filter((refund) => refund.status === "PAID").reduce((total, refund) => total + refund.amount, 0n);

  return (
    <>
      <PageHeader title={t.title} description={t.description} />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t.refunded}
          value={formatAmount(refundedAmount, currency)}
          hint={plural(dict.locale, refunds.length, t.refundedHint)}
        />
        <StatCard label={t.openDisputes} value={String(openDisputes.length)} tone={openDisputes.length > 0 ? "warning" : "muted"} />
        <StatCard label={t.heldAmount} value={formatAmount(heldAmount, currency)} hint={t.heldHint} />
      </section>

      <Card className="py-0">
        <CardHeader className="border-b p-5 pb-4">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-4 text-warning" aria-hidden />
            {t.disputes.title}
          </CardTitle>
          <CardDescription>{t.disputes.description}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {disputes.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={ShieldCheckIcon} title={t.disputes.emptyTitle} description={t.disputes.emptyBody} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">{dict.common.date}</TableHead>
                  <TableHead>{dict.common.customer}</TableHead>
                  <TableHead className="hidden lg:table-cell">{dict.common.product}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t.disputes.evidenceDue}</TableHead>
                  <TableHead className="hidden sm:table-cell">{dict.common.status}</TableHead>
                  <TableHead className="text-right">{dict.common.amount}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((dispute) => (
                  <TableRow key={dispute.id}>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                      {formatDateTime(dispute.createdAt, dict.localeTag)}
                    </TableCell>
                    <TableCell className="max-w-[52vw] sm:max-w-none">
                      <Link href={`/sales/${dispute.payment.orderId}`} className="block truncate font-medium hover:underline">
                        {dispute.payment.customer.name}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">{dispute.payment.customer.email}</span>
                      <span className="block truncate text-xs text-muted-foreground lg:hidden">
                        {dispute.payment.order.items[0]?.productName ?? "—"}
                      </span>
                      <span className="block text-xs text-muted-foreground md:hidden">{formatDateTime(dispute.createdAt, dict.localeTag)}</span>
                      <Badge className="mt-1 sm:hidden" variant={DISPUTE_STATUS_VARIANT[dispute.status]}>
                        {dict.status.dispute[dispute.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{dispute.payment.order.items[0]?.productName ?? "—"}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                      {dispute.evidenceDueAt ? formatDateTime(dispute.evidenceDueAt, dict.localeTag) : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={DISPUTE_STATUS_VARIANT[dispute.status]}>{dict.status.dispute[dispute.status]}</Badge>
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">{formatAmount(dispute.amount, dispute.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardHeader className="border-b p-5 pb-4">
          <CardTitle className="flex items-center gap-2">
            <RotateCcwIcon className="size-4 text-muted-foreground" aria-hidden />
            {t.list.title}
          </CardTitle>
          <CardDescription>{t.list.description}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {refunds.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={RotateCcwIcon}
                title={t.list.emptyTitle}
                description={t.list.emptyBody}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">{dict.common.date}</TableHead>
                  <TableHead>{dict.common.customer}</TableHead>
                  <TableHead className="hidden lg:table-cell">{dict.common.product}</TableHead>
                  <TableHead className="hidden lg:table-cell">{dict.common.reason}</TableHead>
                  <TableHead className="hidden sm:table-cell">{dict.common.status}</TableHead>
                  <TableHead className="text-right">{dict.common.amount}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refunds.map((refund) => (
                  <TableRow key={refund.id}>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                      {formatDateTime(refund.createdAt, dict.localeTag)}
                    </TableCell>
                    <TableCell className="max-w-[52vw] sm:max-w-none">
                      <Link href={`/sales/${refund.payment.orderId}`} className="block truncate font-medium hover:underline">
                        {refund.payment.customer.name}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">{refund.payment.customer.email}</span>
                      <span className="block truncate text-xs text-muted-foreground lg:hidden">
                        {refund.payment.order.items[0]?.productName ?? "—"}
                      </span>
                      <span className="block text-xs text-muted-foreground md:hidden">{formatDateTime(refund.createdAt, dict.localeTag)}</span>
                      <Badge className="mt-1 sm:hidden" variant={REFUND_STATUS_VARIANT[refund.status]}>
                        {dict.status.refund[refund.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{refund.payment.order.items[0]?.productName ?? "—"}</TableCell>
                    <TableCell className="hidden max-w-48 truncate text-muted-foreground lg:table-cell">{refund.reason ?? "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={REFUND_STATUS_VARIANT[refund.status]}>{dict.status.refund[refund.status]}</Badge>
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">{formatAmount(refund.amount, refund.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
