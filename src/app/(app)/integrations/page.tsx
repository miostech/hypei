import { CheckCircle2Icon, CircleAlertIcon, CreditCardIcon, DatabaseIcon, MailIcon, WebhookIcon } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type AppDictionary, getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { countryName } from "@/lib/i18n/countries";
import { fill } from "@/lib/i18n/locale";
import { formatDate } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { MerchantOnboardingButton } from "./merchant-onboarding-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).integrations.title };
}

/** A cor de cada estado da conta; o texto vem de `dict.integrations.statuses`. */
const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "outline" | "secondary"> = {
  PENDING: "outline",
  REQUIRES_ACTION: "warning",
  UNDER_REVIEW: "warning",
  ACTIVE: "success",
  RESTRICTED: "warning",
  DISABLED: "destructive",
};

export default async function IntegrationsPage() {
  const { organization } = await requirePagePermission("organization:read");
  const services = getServices();
  const merchant = await services.merchantAccounts.getForOrganization(organization.id);
  const provider = services.paymentProvider.type;
  const dict = await getAppDictionary(await appLocale());
  const t = dict.integrations;

  return (
    <>
      <PageHeader title={t.title} description={t.description} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCardIcon className="size-4" />
            {t.accountTitle}
          </CardTitle>
          <CardDescription>
            {fill(t.accountDescription, { provider: provider === "MOCK" ? t.mockProvider : "Stripe" })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!merchant ? (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 text-sm">
              <p className="text-muted-foreground">{t.noAccount}</p>
              <MerchantOnboardingButton label={t.createAccount} />
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  label={dict.common.status}
                  value={<Badge variant={STATUS_VARIANT[merchant.status]}>{t.statuses[merchant.status]}</Badge>}
                />
                <Field label={t.canCharge} value={<Flag on={merchant.chargesEnabled} dict={dict} />} />
                <Field label={t.canWithdraw} value={<Flag on={merchant.payoutsEnabled} dict={dict} />} />
                <Field label={dict.verification.country} value={countryName(dict.localeTag, merchant.country)} />
                <Field label={t.currency} value={merchant.defaultCurrency} />
                <Field label={t.createdAt} value={formatDate(merchant.createdAt, dict.localeTag)} />
              </div>
              {merchant.requirementsDue.length > 0 && (
                <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
                  <p className="font-medium">{t.pendingTitle}</p>
                  <ul className="mt-1 list-inside list-disc text-muted-foreground">
                    {merchant.requirementsDue.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </div>
              )}
              <MerchantOnboardingButton label={merchant.detailsSubmitted ? t.updateDetails : t.finishVerification} />
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard
          icon={WebhookIcon}
          title={t.webhooksTitle}
          description={fill(t.webhooksDescription, { provider: provider.toLowerCase() })}
        />
        <InfoCard icon={DatabaseIcon} title={t.apiKeysTitle} description={t.apiKeysDescription} />
        <InfoCard icon={MailIcon} title={t.emailTitle} description={t.emailDescription} />
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function Flag({ on, dict }: { on: boolean; dict: AppDictionary }) {
  return on ? (
    <span className="flex items-center gap-1 text-success">
      <CheckCircle2Icon className="size-4" /> {dict.integrations.yes}
    </span>
  ) : (
    <span className="flex items-center gap-1 text-muted-foreground">
      <CircleAlertIcon className="size-4" /> {dict.integrations.no}
    </span>
  );
}

function InfoCard({ icon: Icon, title, description }: { icon: typeof WebhookIcon; title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
