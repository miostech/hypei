import { ArrowRightIcon, CheckCircle2Icon, ClockIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KabrunLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { memberCourseHref } from "@/lib/ui/routes";
import { getServices } from "@/server/container";
import { PaymentStatusWatcher } from "./status-watcher";

export const metadata = { title: "Pagamento" };

/**
 * Result page. The status shown comes from the Kabrun Payment record, which is only
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

  // Esperar o e-mail chegar era a única porta de entrada, e em serverless ele pode atrasar um
  // ciclo do cron. O link só aparece com conteúdo publicado — a mesma regra do e-mail.
  const course = payment.status === "PAID" ? await services.uow.repos.courses.findByProductId(checkout.product.id) : null;
  const accessHref = course?.published ? memberCourseHref(checkout.organization.slug, course.slug) : null;

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
      <KabrunLogo />
      <div className="w-full max-w-md space-y-3 rounded-xl border bg-card p-8">
        <state.icon className={`mx-auto size-10 ${state.tone}`} aria-hidden />
        <h1 className="text-xl font-semibold tracking-tight">{state.title}</h1>
        <p className="text-pretty text-sm text-muted-foreground">{state.description}</p>

        {accessHref && (
          <div className="space-y-1.5 pt-2">
            <Button className="w-full" render={<Link href={accessHref} />}>
              Acessar agora
              <ArrowRightIcon />
            </Button>
            <p className="text-xs text-muted-foreground">Entre com o mesmo e-mail que você usou nesta compra.</p>
          </div>
        )}

        <p className="pt-2 text-xs text-muted-foreground">
          Vendido por {checkout.organization.name}
          {checkout.organization.supportEmail ? ` · ${checkout.organization.supportEmail}` : ""}
        </p>
      </div>
      {pending && <PaymentStatusWatcher paymentId={paymentId} />}
    </div>
  );
}
