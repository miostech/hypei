import { HandshakeIcon } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getEnv } from "@/lib/env";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill } from "@/lib/i18n/locale";
import { requireOrganization } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { CopyLink } from "../affiliates/copy-link";
import { CatalogTabs } from "../products/catalog-tabs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).affiliations.title };
}

/**
 * O outro lado da afiliação: o que esta pessoa divulga de outros produtores.
 *
 * As afiliações são da pessoa e atravessam organizações. Nenhuma permissão de produtor é
 * exigida: ela não está vendo a operação de ninguém, só o que é dela.
 *
 * Aqui ficam os produtos, e só. O que cada indicação rendeu está no Financeiro e no dashboard,
 * junto com o resto do dinheiro dela — repetir aqui era dar duas respostas para a mesma conta.
 */
export default async function AffiliationsPage() {
  const { userId } = await requireOrganization();
  const affiliations = await getServices().affiliates.listForUser(userId);
  const dict = await getAppDictionary(await appLocale());
  const t = dict.affiliations;
  const appUrl = getEnv().APP_URL;

  return (
    <>
      {/* O título é "Produtos" porque esta é uma das abas dele: o que ela divulga também é produto dela. */}
      <PageHeader title={dict.products.title} description={t.description} />

      <CatalogTabs active="affiliations" dict={dict} />

      {affiliations.length === 0 ? (
        <EmptyState icon={HandshakeIcon} title={t.emptyTitle} description={t.emptyBody} />
      ) : (
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
      )}
    </>
  );
}
