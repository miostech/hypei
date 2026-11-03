import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { countryName } from "@/lib/i18n/countries";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { TaxRegimeForm } from "./tax-regime-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).settings.title };
}

export default async function SettingsPage() {
  const { organization, membership } = await requirePagePermission("organization:read");
  const services = getServices();
  const [taxIdentities, verification, taxSettings] = await Promise.all([
    services.uow.repos.organizations.taxIdentities(organization.id),
    services.uow.repos.organizations.latestVerification(organization.id),
    services.taxSettings.get(organization.id),
  ]);
  const canManage = membership.role === "OWNER" || membership.role === "ADMIN";
  const dict = await getAppDictionary(await appLocale());
  const t = dict.settings;

  return (
    <>
      <PageHeader title={t.title} description={t.description} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.organizationTitle}</CardTitle>
            <CardDescription>{t.organizationDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Item label={dict.common.name} value={organization.name} />
              <Item label={t.slug} value={`/${organization.slug}`} />
              <Item label={dict.verification.country} value={countryName(dict.localeTag, organization.country)} />
              <Item label={t.defaultCurrency} value={organization.defaultCurrency} />
              <Item label={t.businessType} value={organization.businessType === "COMPANY" ? t.company : t.individual} />
              <Item label={t.yourAccess} value={dict.roles[membership.role] ?? membership.role} />
              <Item label={t.supportEmail} value={organization.supportEmail ?? "—"} />
              <Item label={t.website} value={organization.website ?? "—"} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.taxTitle}</CardTitle>
            <CardDescription>{t.taxDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.common.type}</TableHead>
                  <TableHead>{t.document}</TableHead>
                  <TableHead>{dict.verification.country}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxIdentities.map((identity) => (
                  <TableRow key={identity.type}>
                    <TableCell>{identity.type}</TableCell>
                    <TableCell className="tabular">{identity.maskedValue}</TableCell>
                    <TableCell className="text-muted-foreground">{identity.country}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t.verificationLabel}</span>
              <Badge variant={verification?.status === "VERIFIED" ? "success" : verification?.status === "REJECTED" ? "destructive" : "warning"}>
                {dict.verification.statuses[verification?.status ?? "NOT_STARTED"].label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t.regimeTitle}</CardTitle>
            <CardDescription>{t.regimeDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <TaxRegimeForm settings={taxSettings} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t.regimeReadOnly}{" "}
                <span className="font-medium text-foreground">{t.taxRegimes[taxSettings.regime].label}</span>
                {taxSettings.rate && <> · {taxSettings.rate}%</>}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
