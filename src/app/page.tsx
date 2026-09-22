import { ArrowRightIcon, BanknoteIcon, GlobeIcon, LayersIcon, LockIcon, ReceiptIcon, ZapIcon } from "lucide-react";
import Link from "next/link";
import { HypeiLogo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SIGNUP_HREF = "/api/auth/login?signup=1&returnTo=%2Fonboarding";

const FEATURES = [
  {
    icon: GlobeIcon,
    title: "Venda global, pagamento local",
    description: "Brasil, Europa e Estados Unidos com os meios de pagamento que cada comprador já usa — e nada que não funcione no país dele.",
  },
  {
    icon: ReceiptIcon,
    title: "Financeiro auditável",
    description: "Cada centavo passa por um ledger de partida dobrada. Nenhum lançamento é editado: correções viram novos lançamentos.",
  },
  {
    icon: BanknoteIcon,
    title: "Saldo e saques transparentes",
    description: "Você vê o que está pendente, o que está disponível e o que está reservado — com a data de liberação de cada venda.",
  },
  {
    icon: LayersIcon,
    title: "Checkout que é seu",
    description: "Monte a página, versione cada alteração e saiba exatamente qual versão o comprador viu na hora da compra.",
  },
  {
    icon: LockIcon,
    title: "Segurança desde a base",
    description: "Identidade no Keycloak, isolamento por organização, webhooks assinados e nenhum dado sensível de cartão no nosso banco.",
  },
  {
    icon: ZapIcon,
    title: "Área de membros incluída",
    description: "O acesso ao conteúdo é liberado no momento em que o pagamento é confirmado pelo provedor.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-sm">
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <HypeiLogo />
          <div className="flex items-center gap-2">
            {/* Route handlers are not client-routable: plain anchors avoid a failed RSC prefetch. */}
            <Button variant="ghost" size="sm" render={<a href="/api/auth/login" />}>
              Entrar
            </Button>
            <Button size="sm" render={<a href={SIGNUP_HREF} />}>
              Criar conta grátis
            </Button>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-[radial-gradient(60%_100%_at_50%_100%,var(--primary)/18%,transparent)]"
          />
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center sm:py-28">
            <Badge variant="outline" className="h-6 gap-1.5">
              <span className="size-1.5 rounded-full bg-primary" />
              Brasil · Europa · Estados Unidos
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Venda para o mundo inteiro com a Hypei.</h1>
            <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
              Crie, venda e escale produtos digitais, cursos, comunidades e assinaturas com pagamentos locais e uma operação global.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" render={<a href={SIGNUP_HREF} />}>
                Criar conta grátis
                <ArrowRightIcon />
              </Button>
              <Button size="lg" variant="outline" render={<Link href="#como-funciona" />}>
                Conhecer a Hypei
              </Button>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-balance">Uma plataforma de pagamentos, não só um checkout</h2>
            <p className="mt-3 text-pretty text-muted-foreground">
              A Hypei recebe do comprador, calcula as taxas, registra tudo no ledger e repassa para você quando o prazo de liberação vence.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-xl border bg-card p-5">
                <feature.icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-3 font-medium">{feature.title}</h3>
                <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:py-20">
            <h2 className="text-center text-2xl font-semibold tracking-tight">Do checkout à sua conta bancária</h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { step: "1", title: "Compra", text: "O comprador paga no seu checkout, com o método local dele." },
                { step: "2", title: "Confirmação", text: "O provedor confirma o pagamento e a Hypei registra a venda no ledger." },
                { step: "3", title: "Liberação", text: "Passado o prazo de settlement, o valor vira saldo disponível." },
                { step: "4", title: "Saque", text: "Você solicita o saque e acompanha até cair na conta." },
              ].map((item) => (
                <li key={item.step} className="rounded-xl border bg-background p-5">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{item.step}</span>
                  <h3 className="mt-3 font-medium">{item.title}</h3>
                  <p className="mt-1 text-sm text-pretty text-muted-foreground">{item.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <HypeiLogo className="text-muted-foreground" />
          <p>© {new Date().getFullYear()} Hypei</p>
        </div>
      </footer>
    </div>
  );
}
