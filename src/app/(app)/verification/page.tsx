import { AlertTriangleIcon, BanknoteIcon, CheckCircle2Icon, ClockIcon, ShieldCheckIcon, ShoppingBagIcon, XCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { VerificationStatus } from "@/generated/prisma/enums";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill } from "@/lib/i18n/locale";
import { formatDateTime } from "@/lib/ui/format";
import { describeRequirements } from "@/modules/compliance/verification.requirements";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { hasPermission } from "@/modules/organizations/permissions";
import { getServices } from "@/server/container";
import { VerificationActions } from "./verification-actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).verification.title };
}

/** A cor de cada estado; o texto vem de `dict.verification.statuses`. */
const STATUS_VARIANT: Record<VerificationStatus, "success" | "warning" | "destructive" | "outline"> = {
  NOT_STARTED: "outline",
  PENDING: "warning",
  REQUIRES_ACTION: "warning",
  VERIFIED: "success",
  REJECTED: "destructive",
  SUSPENDED: "destructive",
};

export default async function VerificationPage() {
  const { organization, membership } = await requirePagePermission("organization:read");
  const overview = await getServices().verification.overview(organization.id);
  const dict = await getAppDictionary(await appLocale());
  const t = dict.verification;

  const variant = STATUS_VARIANT[overview.status];
  const status = t.statuses[overview.status];
  const requirements = describeRequirements(overview.requirementCodes, t.requirements);
  const canEdit = hasPermission(membership.role, "integrations:manage");

  const actionLabel = !overview.hasAccount ? t.start : overview.detailsSubmitted ? t.review : t.continue;

  return (
    <>
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        actions={<VerificationActions label={actionLabel} canStart={canEdit} />}
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <span
            className={`flex size-11 items-center justify-center rounded-2xl ${
              overview.status === "VERIFIED"
                ? "bg-success/12 text-success"
                : variant === "destructive"
                  ? "bg-destructive/12 text-destructive"
                  : "bg-warning/12 text-warning"
            }`}
          >
            {overview.status === "VERIFIED" ? (
              <ShieldCheckIcon className="size-6" aria-hidden />
            ) : variant === "destructive" ? (
              <XCircleIcon className="size-6" aria-hidden />
            ) : (
              <ClockIcon className="size-6" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-heading font-semibold">
              {status.label}
              <Badge variant={variant}>{overview.provider}</Badge>
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{status.description}</p>
          </div>
          {overview.verifiedAt && (
            <p className="text-xs text-muted-foreground">{fill(t.verifiedAt, { date: formatDateTime(overview.verifiedAt, dict.localeTag) })}</p>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3">
            <span className={`flex size-10 items-center justify-center rounded-xl ${overview.canSell ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"}`}>
              <ShoppingBagIcon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-medium">{overview.canSell ? t.sellOn : t.sellOff}</p>
              <p className="text-sm text-muted-foreground">
                {overview.canSell ? t.sellOnBody : t.sellOffBody}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <span className={`flex size-10 items-center justify-center rounded-xl ${overview.canWithdraw ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"}`}>
              <BanknoteIcon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-medium">{overview.canWithdraw ? t.withdrawOn : t.withdrawOff}</p>
              <p className="text-sm text-muted-foreground">
                {overview.canWithdraw ? t.withdrawOnBody : t.withdrawOffBody}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {requirements.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="size-4 text-warning" aria-hidden />
              {t.missingTitle}
            </CardTitle>
            <CardDescription>{t.missingDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {requirements.map((requirement) => (
                <li key={requirement.code} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-warning/50 text-warning">
                    <span className="size-1.5 rounded-full bg-warning" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{requirement.label}</p>
                    {requirement.hint && <p className="text-xs text-muted-foreground">{requirement.hint}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>{t.dataTitle}</CardTitle>
          <CardDescription>{t.dataDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Row label={t.businessType} value={overview.businessType === "INDIVIDUAL" ? t.individual : t.company} />
          <Row label={t.legalName} value={overview.legalName ?? organization.name} />
          <Row label={t.country} value={overview.country} />
          {overview.taxIdentities.map((identity) => (
            <Row key={identity.type} label={identity.type} value={identity.maskedValue} />
          ))}
          {overview.submittedAt && <Row label={t.submittedAt} value={formatDateTime(overview.submittedAt, dict.localeTag)} />}
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
        <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t.footnote}
      </p>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3 border-b pb-2 last:border-0 sm:border-0 sm:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </p>
  );
}
