import {
  ArrowRightIcon,
  BanknoteIcon,
  CheckIcon,
  GlobeIcon,
  LanguagesIcon,
  LayersIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { KabrunLogo, KabrunMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { SUPPORTED_COUNTRIES } from "@/modules/organizations/countries";
import { PROCESSABLE_PAYMENT_METHODS } from "@/modules/payments/payment-method-resolver";
import { SUPPORTED_CURRENCIES } from "@/lib/money/currency";

const SIGNUP_HREF = "/api/auth/login?signup=1&returnTo=%2Fonboarding";

const FEATURES = [
  {
    icon: LanguagesIcon,
    title: "Traduza as aulas, não regrave",
    description: "O curso que você já gravou passa a vender em inglês e espanhol. Mesma aula, mesma gravação, outro idioma.",
  },
  {
    icon: GlobeIcon,
    title: "Cada comprador paga como paga em casa",
    description: "Pix e boleto para quem está no Brasil, cartão e carteiras em euro e em dólar lá fora. O que não funciona no país dele nem aparece.",
  },
  {
    icon: ReceiptIcon,
    title: "Financeiro que você consegue auditar",
    description: "Cada centavo passa por um ledger de partida dobrada. Nenhum lançamento é editado: correção vira lançamento novo.",
  },
  {
    icon: BanknoteIcon,
    title: "Saldo sem letra miúda",
    description: "O que está pendente, o que está disponível e o que está reservado — com a data de liberação de cada venda, não um número só.",
  },
  {
    icon: LayersIcon,
    title: "Checkout que é seu",
    description: "Monte a página, versione cada alteração e saiba exatamente qual versão o comprador viu na hora em que pagou.",
  },
  {
    icon: ZapIcon,
    title: "Área de membros incluída",
    description: "O aluno entra no conteúdo no instante em que o provedor confirma o pagamento. Sem fila, sem liberação manual.",
  },
];

/** Os números saem do código (moedas, países, matriz do provedor) para não envelhecerem calados. */
const STATS = [
  { value: String(SUPPORTED_CURRENCIES.length), label: "moedas", hint: "Real, euro e dólar na mesma conta" },
  { value: String(SUPPORTED_COUNTRIES.length), label: "países", hint: "Brasil, Portugal, Espanha, França, Alemanha, Itália e EUA" },
  { value: String(PROCESSABLE_PAYMENT_METHODS), label: "meios de pagamento", hint: "Pix, boleto, cartão, SEPA, transferência e carteiras" },
  { value: "D+0", label: "liberação de acesso", hint: "O aluno entra assim que o pagamento confirma" },
];

/**
 * O argumento de troca. Kiwify e Cakto cobram só em real; quem chega de fora não consegue
 * pagar. É o buraco concreto que a Kabrun tapa, e é o que decide a mudança de plataforma.
 */
const SWITCH = [
  {
    before: "Seu curso só vende em real, para quem está no Brasil.",
    after: "O mesmo curso vende em real, euro e dólar.",
  },
  {
    before: "Um comprador de Lisboa acha sua página e não tem como pagar.",
    after: "Ele paga com o cartão dele, em euro, sem conversão estranha na fatura.",
  },
  {
    before: "Vender em inglês significa regravar o curso inteiro.",
    after: "Você traduz as aulas que já estão gravadas.",
  },
  {
    before: "O extrato é uma lista de valores que você aceita no escuro.",
    after: "Cada centavo nasce de um lançamento contábil que você pode conferir.",
  },
];

const STEPS = [
  { title: "Compra", text: "O comprador paga no seu checkout, na moeda e no método do país dele." },
  { title: "Confirmação", text: "O provedor confirma o pagamento e a Kabrun registra a venda no ledger." },
  { title: "Liberação", text: "Passado o prazo de settlement, o valor vira saldo disponível." },
  { title: "Saque", text: "Você solicita o saque e acompanha até cair na conta." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <KabrunLogo showMark={false} />
          <div className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <Link href="#por-que-mudar" className="transition-colors hover:text-foreground">
              Por que mudar
            </Link>
            <Link href="#recursos" className="transition-colors hover:text-foreground">
              Recursos
            </Link>
            <Link href="#como-funciona" className="transition-colors hover:text-foreground">
              Como funciona
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {/* Route handlers are not client-routable: plain anchors avoid a failed RSC prefetch. */}
            <Button variant="ghost" size="sm" render={<a href="/api/auth/login" />}>
              Entrar
            </Button>
            <Button
              size="sm"
              className="bg-gold-gradient border-0 text-gold-foreground shadow-gold hover:opacity-90"
              render={<a href={SIGNUP_HREF} />}
            >
              Criar conta grátis
            </Button>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <section className="bg-aurora relative overflow-hidden">
          <span aria-hidden className="bg-dot-grid pointer-events-none absolute inset-0 text-foreground/[0.07]" />
          <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-7 px-4 pt-20 pb-10 text-center sm:pt-28">
            <h1 className="max-w-4xl font-heading text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl">
              O mesmo curso, vendido em <span className="text-brand-gradient">três moedas e três idiomas</span>.
            </h1>

            <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
              A Kabrun traduz as aulas que você já gravou, cobra em real, euro ou dólar e mostra a cada comprador o meio de pagamento que funciona no
              país dele. Sem regravar o curso e sem abrir empresa lá fora.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="bg-gold-gradient border-0 text-gold-foreground shadow-gold hover:opacity-90"
                render={<a href={SIGNUP_HREF} />}
              >
                Criar conta grátis
                <ArrowRightIcon />
              </Button>
              <Button size="lg" variant="outline" className="bg-card" render={<Link href="#como-funciona" />}>
                Ver como funciona
              </Button>
            </div>

            <p className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckIcon className="size-3.5 text-success" /> Sem mensalidade
              </span>
              <span className="flex items-center gap-1.5">
                <CheckIcon className="size-3.5 text-success" /> Você só paga quando vender
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheckIcon className="size-3.5 text-success" /> Pagamentos processados pela Stripe
              </span>
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-5xl px-4 pb-20">
            <AppPreview />
          </div>
        </section>

        <section className="border-y bg-card">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-px bg-border lg:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="bg-card px-6 py-8 text-center">
                <p className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{stat.value}</p>
                <p className="mt-1 text-sm font-medium">{stat.label}</p>
                <p className="mt-1 text-xs text-pretty text-muted-foreground">{stat.hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="por-que-mudar" className="mx-auto w-full max-w-6xl px-4 py-20 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Por que mudar</p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Sua plataforma de hoje só sabe vender em real
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground">
              O seu conteúdo não tem fronteira, mas o seu checkout tem. É isso que a Kabrun muda.
            </p>
          </div>

          <div className="mt-12 overflow-hidden rounded-2xl border shadow-soft">
            {/* Lado a lado só a partir do sm: em 375px duas colunas quebram o texto em uma
                palavra por linha. Empilhado, o X apagado e o check em destaque já dizem qual é
                qual, então os títulos das colunas somem junto. */}
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
              <p className="hidden bg-muted/60 px-5 py-3 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase sm:block">Hoje</p>
              <p className="hidden bg-card px-5 py-3 text-xs font-semibold tracking-[0.12em] text-primary uppercase sm:block">Na Kabrun</p>

              {SWITCH.map((row) => (
                <Fragment key={row.before}>
                  <div className="flex items-start gap-2.5 bg-muted/30 px-5 py-4">
                    <XIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <p className="text-sm text-pretty text-muted-foreground">{row.before}</p>
                  </div>
                  <div className="flex items-start gap-2.5 bg-card px-5 py-4">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    <p className="text-sm font-medium text-pretty">{row.after}</p>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>

          {/* O formulário de checkout já diz o mesmo ao produtor. Prometer menos aqui do que o
              produto entrega depois é o que gera o primeiro pedido de reembolso. */}
          <p className="mt-4 text-center text-xs text-pretty text-muted-foreground">
            Os meios disponíveis em cada venda dependem do país da sua conta de recebimento e da moeda da oferta.
          </p>
        </section>

        <section id="recursos" className="mx-auto w-full max-w-6xl px-4 py-20 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Plataforma</p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Vender lá fora não pode dar mais trabalho que vender aqui
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground">
              Tudo que a sua operação precisa para traduzir, vender, receber e provar para onde cada centavo foi.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card"
              >
                <span className="bg-brand-gradient flex size-11 items-center justify-center rounded-xl text-white shadow-soft">
                  <feature.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-heading text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-pretty text-muted-foreground">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="border-y bg-card/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Como funciona</p>
              <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">Do checkout à sua conta bancária</h2>
            </div>

            <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="rounded-2xl border bg-card p-6 shadow-soft">
                  <span className="bg-brand-gradient flex size-9 items-center justify-center rounded-xl font-heading text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-heading font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:py-24">
          <div className="bg-brand-gradient relative isolate overflow-hidden rounded-3xl px-6 py-14 text-center text-white shadow-lift sm:px-12">
            <span aria-hidden className="bg-dot-grid pointer-events-none absolute inset-0 text-white/15 opacity-40" />
            <span
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(242_199_92/0.28),transparent_65%)]"
            />
            <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5">
              <KabrunMark className="size-12" />
              <h2 className="font-heading text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
                Seu próximo aluno pode não falar português
              </h2>
              <p className="text-pretty text-white/75">
                Criar a conta leva menos de cinco minutos e não custa nada enquanto você não vender. O curso você já tem.
              </p>
              <Button
                size="lg"
                className="bg-gold-gradient border-0 text-gold-foreground shadow-gold hover:opacity-90"
                render={<a href={SIGNUP_HREF} />}
              >
                Criar conta grátis
                <ArrowRightIcon />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row">
          <KabrunLogo />
          <p>© {new Date().getFullYear()} Kabrun · Pagamentos para criadores</p>
        </div>
      </footer>
    </div>
  );
}

/** Stylised product shot for the hero — decorative only, so it is hidden from assistive tech. */
function AppPreview() {
  return (
    <div aria-hidden className="relative rounded-3xl border bg-card p-2 shadow-lift">
      <div className="overflow-hidden rounded-2xl border bg-background">
        <div className="flex items-center gap-1.5 border-b bg-muted/60 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-destructive/50" />
          <span className="size-2.5 rounded-full bg-warning/60" />
          <span className="size-2.5 rounded-full bg-success/50" />
          <span className="ml-3 rounded-md bg-card px-2.5 py-1 text-[0.6rem] text-muted-foreground ring-1 ring-border">app.kabrun.com.br/dashboard</span>
        </div>

        <div className="flex">
          <aside className="hidden w-14 flex-col items-center gap-3 bg-sidebar py-4 sm:flex">
            <KabrunMark className="size-7" />
            <span className="mt-2 size-7 rounded-lg bg-white/15" />
            <span className="size-7 rounded-lg bg-white/8" />
            <span className="size-7 rounded-lg bg-white/8" />
            <span className="size-7 rounded-lg bg-white/8" />
          </aside>

          <div className="grid flex-1 gap-3 p-3 sm:grid-cols-3 sm:p-4">
            <div className="bg-brand-gradient relative overflow-hidden rounded-xl p-4 text-white sm:col-span-2">
              <span className="bg-dot-grid absolute inset-0 text-white/15 opacity-40" />
              <p className="relative text-[0.6rem] tracking-[0.14em] text-white/70 uppercase">Saldo disponível</p>
              <p className="tabular relative mt-1 font-heading text-2xl font-extrabold sm:text-3xl">R$ 48.920,00</p>
              <div className="relative mt-3 flex gap-4 text-[0.65rem] text-white/70">
                <span>A liberar · R$ 12.480,00</span>
                <span className="hidden sm:inline">Reservado · R$ 0,00</span>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-2 rounded-xl border bg-card p-4">
              <p className="text-[0.6rem] text-muted-foreground">Vendas (30 dias)</p>
              <p className="tabular font-heading text-xl font-bold">R$ 86.310</p>
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[0.6rem] font-medium text-success">
                +18,4%
              </span>
            </div>

            <div className="rounded-xl border bg-card p-4 sm:col-span-3">
              <div className="flex items-center justify-between">
                <p className="text-[0.65rem] font-medium">Vendas confirmadas</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[0.55rem] text-muted-foreground">30 dias</span>
              </div>
              <svg viewBox="0 0 320 72" className="mt-3 h-20 w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="preview-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 58 L26 52 L52 56 L78 40 L104 46 L130 30 L156 36 L182 22 L208 28 L234 14 L260 20 L286 10 L320 16 L320 72 L0 72 Z"
                  fill="url(#preview-area)"
                />
                <path
                  d="M0 58 L26 52 L52 56 L78 40 L104 46 L130 30 L156 36 L182 22 L208 28 L234 14 L260 20 L286 10 L320 16"
                  fill="none"
                  stroke="var(--chart-1)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
