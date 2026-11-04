import { HandshakeIcon } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getEnv } from "@/lib/env";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill } from "@/lib/i18n/locale";
import { formatAmount, formatDateTime } from "@/lib/ui/format";
import { requireOrganization } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { CopyLink } from "../affiliates/copy-link";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).affiliations.title };
}

/**
 * O outro lado da afiliação: o que esta pessoa divulga de outros produtores.
 *
 * As afiliações são da pessoa e atravessam organizações; as comissões são lidas pela conta que
 * recebe. Nenhuma permissão de produtor é exigida: ela não está vendo a operação de ninguém,
 * só o que é dela.
 */
export default async function AffiliationsPage() {
  const { organization, userId } = await requireOrganization();
  const services = getServices();
  const [affiliations, earnings] = await Promise.all([
    services.affiliates.listForUser(userId),
    services.affiliates.earningsForUser(organization.id, 50),
  ]);
  const dict = await getAppDictionary(await appLocale());
  const t = dict.affiliations;
  const appUrl = getEnv().APP_URL;
  const currency = organization.defaultCurrency;

  const sum = (statuses: string[]) =>
    earnings
      .filter((commission) => statuses.includes(commission.status))
      .reduce((total, commission) => total + (commission.amount - commission.reversedAmount), 0n);

  return (
    <>
      <PageHeader title={t.title} description={t.description} />

      {affiliations.length === 0 ? (
        <EmptyState icon={HandshakeIcon} title={t.emptyTitle} description={t.emptyBody} />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard label={t.pending} value={formatAmount(sum(["PENDING"]), currency)} hint={t.pendingHint} />
            <StatCard
              label={t.available}
              value={formatAmount(sum(["AVAILABLE", "APPROVED"]), currency)}
              tone={sum(["AVAILABLE", "APPROVED"]) > 0n ? "warning" : "muted"}
            />
            <StatCard label={t.received} value={formatAmount(sum(["PAID"]), currency)} tone="positive" />
          </section>

          <Card className="py-0">
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.common.product}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t.producer}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t.commission}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t.link}</TableHead>
                    <TableHead className="hidden text-right xl:table-cell">{t.clicks}</TableHead>
                    <TableHead>{dict.common.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliations.map((affiliation) => (
                    <TableRow key={affiliation.id}>
                      <TableCell className="max-w-[46vw] sm:max-w-none">
                        <span className="block truncate font-medium">{affiliation.product.name}</span>
                        <span className="block truncate text-xs text-muted-foreground sm:hidden">
                          {affiliation.product.organization.name} ·{" "}
                          {fill(dict.affiliates.commissionOf, { percent: affiliation.commissionBps / 100 })}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {affiliation.product.organization.name}
                      </TableCell>
                      <TableCell className="hidden font-medium sm:table-cell">{affiliation.commissionBps / 100}%</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {affiliation.status === "ACTIVE" ? (
                          <CopyLink url={`${appUrl}/r/${affiliation.code}`} label={affiliation.product.name} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular hidden text-right text-muted-foreground xl:table-cell">
                        {affiliation.clicks}
                      </TableCell>
                      <TableCell>
                        {affiliation.status === "ACTIVE" ? (
                          <Badge variant="success">{dict.affiliates.active}</Badge>
                        ) : (
                          <Badge variant="outline">{t.revoked}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {earnings.length > 0 && (
        <Card className="py-0">
          <CardHeader className="border-b p-5 pb-4">
            <CardTitle>{t.earningsTitle}</CardTitle>
            <CardDescription>{t.earningsDescription}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">{dict.common.date}</TableHead>
                  <TableHead>{dict.common.product}</TableHead>
                  <TableHead className="hidden sm:table-cell">{dict.common.status}</TableHead>
                  <TableHead className="text-right">{t.commission}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                      {formatDateTime(commission.createdAt, dict.localeTag)}
                    </TableCell>
                    <TableCell className="max-w-[46vw] sm:max-w-none">
                      <span className="block truncate font-medium">{commission.order.items[0]?.productName ?? "—"}</span>
                      <span className="block text-xs text-muted-foreground md:hidden">
                        {formatDateTime(commission.createdAt, dict.localeTag)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        variant={
                          commission.status === "PAID" ? "success" : commission.status === "AVAILABLE" ? "warning" : "outline"
                        }
                      >
                        {dict.affiliates.statuses[commission.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {formatAmount(commission.amount - commission.reversedAmount, commission.currency)}
                    </TableCell>
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
