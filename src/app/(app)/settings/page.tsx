import { InfoIcon, LandmarkIcon } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { countryName } from "@/lib/i18n/countries";
import { fill } from "@/lib/i18n/locale";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { paysWithPix } from "@/modules/payouts/payout-destination.service";
import { getServices } from "@/server/container";
import { PixKeyForm } from "./pix-key-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).settings.title };
}

export default async function SettingsPage() {
  const { organization, membership } = await requirePagePermission("organization:read");
  const services = getServices();
  const paysPix = paysWithPix(organization.country);
  const [taxIdentities, verification, pix] = await Promise.all([
    services.uow.repos.organizations.taxIdentities(organization.id),
    services.uow.repos.organizations.latestVerification(organization.id),
    paysPix ? services.payoutDestinations.getPix(organization.id) : null,
  ]);
  const dict = await getAppDictionary(await appLocale());
  const t = dict.settings;
  const canManage = hasPermission(membership.role, "organization:manage");
  // O documento que a chave precisa acompanhar. É o que a produtora cadastrou na verificação —
  // CNPJ quando é empresa, CPF quando é pessoa física.
  const document = taxIdentities[0];

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

      </div>

      {/*
        Para onde o dinheiro vai. No Brasil quem paga é a Kabrun, por Pix, e a chave tem que
        estar aqui; fora dele quem paga é o provedor, na conta que ela cadastrou com ele.
      */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LandmarkIcon className="size-4" />
            {t.bankTitle}
          </CardTitle>
          <CardDescription>{t.bankDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!paysPix ? (
            <p className="text-sm text-muted-foreground">
              {fill(t.providerDestination, { provider: services.paymentProvider.type === "MOCK" ? dict.integrations.mockProvider : "Stripe" })}
            </p>
          ) : (
            <>
              {canManage ? (
                <PixKeyForm pixKey={pix?.pixKey ?? null} />
              ) : (
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Item label={t.pixKey} value={pix?.masked ?? "—"} />
                </dl>
              )}
              <Alert>
                <InfoIcon />
                <AlertDescription>
                  {document
                    ? fill(t.pixOwnership, { document: `${document.type} ${document.maskedValue}` })
                    : t.pixOwnershipUnknown}
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>
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
