import { CheckCircle2Icon, ClockIcon, XCircleIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { RipayLogo } from "@/components/brand/logo";
import { getServices } from "@/server/container";
import { PaymentStatusWatcher } from "./status-watcher";

export const metadata = { title: "Pagamento" };

/**
 * Result page. The status shown comes from the Ripay Payment record, which is only
 * marked PAID after the provider's webhook is processed — never from the redirect.
 */
export default async function CheckoutResultPage({ params, searchParams }: PageProps<"/checkout/[slug]/obrigado">) {
  const { slug } = await params;
  const query = await searchParams;
  const paymentId = typeof query.payment === "string" ? query.payment : null;
  if (!paymentId) notFound();

  const services = getServices();
  const [payment, checkout] = await Promise.all([
    services.payments.getPublicStatus(paymentId).catch(() => null),
    services.checkouts.getPublic(slug),
  ]);
  if (!payment || !checkout) notFound();

  const state =
    payment.status === "PAID"
      ? ({
          icon: CheckCircle2Icon,
          tone: "text-success",
          title: "Pagamento confirmado!",
          description: `Enviamos os dados de acesso a ${checkout.product.name} para o seu e-mail.`,
        } as const)
      : payment.status === "FAILED" || payment.status === "CANCELED"
        ? ({
            icon: XCircleIcon,
            tone: "text-destructive",
            title: "Pagamento não aprovado",
            description: "Nenhum valor foi cobrado. Você pode tentar novamente com outro método de pagamento.",
          } as const)
        : ({
            icon: ClockIcon,
            tone: "text-warning",
            title: "Estamos confirmando seu pagamento",
            description: "Isso costuma levar alguns segundos. Esta página atualiza sozinha.",
          } as const);

  const pending = payment.status !== "PAID" && payment.status !== "FAILED" && payment.status !== "CANCELED";

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/30 p-4 text-center">
      <RipayLogo />
      <div className="w-full max-w-md space-y-3 rounded-xl border bg-card p-8">
        <state.icon className={`mx-auto size-10 ${state.tone}`} aria-hidden />
        <h1 className="text-xl font-semibold tracking-tight">{state.title}</h1>
        <p className="text-pretty text-sm text-muted-foreground">{state.description}</p>
        <p className="pt-2 text-xs text-muted-foreground">
          Vendido por {checkout.organization.name}
          {checkout.organization.supportEmail ? ` · ${checkout.organization.supportEmail}` : ""}
        </p>
      </div>
      {pending && <PaymentStatusWatcher paymentId={paymentId} />}
    </div>
  );
}
