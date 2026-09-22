import { CheckCircle2Icon, CircleAlertIcon, CreditCardIcon, DatabaseIcon, MailIcon, WebhookIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { MerchantOnboardingButton } from "./merchant-onboarding-button";

export const metadata = { title: "Integrações" };

const MERCHANT_STATUS: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "outline" | "secondary" }> = {
  PENDING: { label: "Aguardando dados", variant: "outline" },
  REQUIRES_ACTION: { label: "Ação necessária", variant: "warning" },
  UNDER_REVIEW: { label: "Em análise", variant: "warning" },
  ACTIVE: { label: "Ativa", variant: "success" },
  RESTRICTED: { label: "Restrita", variant: "warning" },
  DISABLED: { label: "Desativada", variant: "destructive" },
};

export default async function IntegrationsPage() {
  const { organization } = await requirePagePermission("organization:read");
  const services = getServices();
  const merchant = await services.merchantAccounts.getForOrganization(organization.id);
  const provider = services.paymentProvider.type;
  const status = merchant ? MERCHANT_STATUS[merchant.status] : null;

  return (
    <>
      <PageHeader title="Integrações" description="Conta de recebimento, webhooks e serviços conectados à sua operação." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCardIcon className="size-4" />
            Conta de recebimento
          </CardTitle>
          <CardDescription>
            Provedor de pagamentos: <strong>{provider === "MOCK" ? "Simulado (desenvolvimento)" : "Stripe"}</strong>. A verificação de identidade e os
            dados bancários são coletados pelo próprio provedor — a Hypei não armazena esses dados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!merchant ? (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 text-sm">
              <p className="text-muted-foreground">Nenhuma conta de recebimento criada para esta organização.</p>
              <MerchantOnboardingButton label="Criar conta de recebimento" />
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Status" value={<Badge variant={status!.variant}>{status!.label}</Badge>} />
                <Field label="Pode cobrar" value={<Flag on={merchant.chargesEnabled} />} />
                <Field label="Pode sacar" value={<Flag on={merchant.payoutsEnabled} />} />
                <Field label="País" value={merchant.country} />
                <Field label="Moeda" value={merchant.defaultCurrency} />
                <Field label="Criada em" value={formatDate(merchant.createdAt)} />
              </div>
              {merchant.requirementsDue.length > 0 && (
                <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
                  <p className="font-medium">Pendências do provedor</p>
                  <ul className="mt-1 list-inside list-disc text-muted-foreground">
                    {merchant.requirementsDue.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </div>
              )}
              <MerchantOnboardingButton label={merchant.detailsSubmitted ? "Atualizar dados" : "Concluir verificação"} />
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard icon={WebhookIcon} title="Webhooks de entrada" description={`POST /api/webhooks/${provider.toLowerCase()} — assinatura verificada e eventos deduplicados.`} />
        <InfoCard icon={DatabaseIcon} title="API Keys" description="Chaves de API para integrações externas chegam em uma próxima fase." />
        <InfoCard icon={MailIcon} title="E-mail" description="Provedor de e-mail configurável (console em desenvolvimento, Resend/SES/Postmark em produção)." />
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

function Flag({ on }: { on: boolean }) {
  return on ? (
    <span className="flex items-center gap-1 text-success">
      <CheckCircle2Icon className="size-4" /> Sim
    </span>
  ) : (
    <span className="flex items-center gap-1 text-muted-foreground">
      <CircleAlertIcon className="size-4" /> Não
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
