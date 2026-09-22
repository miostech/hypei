# ADR 004 — Abstração de provedor de pagamento (Stripe)

**Status:** aceito · **Data:** 2026-09-22 · **Fase:** 1

## Contexto

A Fase 1 usa **Stripe** como PSP único (Payments, Connect, Billing, Webhooks, Refunds, Disputes,
Payouts) para Brasil, Europa e EUA. Ainda assim, a regra de negócio não pode ficar acoplada ao SDK:
provedores mudam, e cada país pode exigir um PSP diferente no futuro.

## Decisão

Uma interface `PaymentProvider` (criar cliente, criar/consultar/cancelar pagamento, reembolsar,
assinaturas, conta de recebimento, link de onboarding, payout, verificar e processar webhook) com
duas implementações: `StripePaymentProvider` e `MockPaymentProvider`.

- O SDK da Stripe é instanciado em **um único lugar** (`src/lib/stripe/stripe-client.ts`).
- Serviços chamam `PaymentService` → `PaymentProvider`; nunca `stripe.paymentIntents.create()`.
- Webhooks dos provedores viram **eventos normalizados** (`payment.succeeded`, `refund.succeeded`,
  `dispute.updated`, `payout.updated`, `merchant_account.updated`…). O domínio nunca vê payload da Stripe.
- A conta conectada é modelada como `MerchantAccount` (genérica), não `StripeAccount`. O status
  interno é derivado de capacidades **e** requirements, nunca de um booleano só.
- Operações críticas usam idempotency key estável: `payment:{id}`, `refund:{id}`, `payout:{id}`,
  `merchant:{organizationId}`.

**Modelo de dinheiro (separate charges and transfers):** o comprador paga a plataforma; o ledger da
Hypei controla quanto cada produtor tem a receber; o repasse é um transfer para a conta conectada
seguido de payout (contas com agendamento manual), para que a liberação siga a política da Hypei e
não o calendário do PSP.

O `MockPaymentProvider` existe para desenvolvimento e testes: determinístico, sem dinheiro real, e
**emite webhooks assinados** — o caminho de confirmação é o mesmo de produção.

## Consequências

- Um pouco mais de código (mapeadores, tipos normalizados) em troca de trocar/adicionar PSP sem
  tocar em regra de negócio.
- A taxa real de processamento vem da balance transaction do charge, não de uma estimativa.
- Recursos exclusivos de um PSP precisam entrar pela interface, ou ficam fora do domínio.

## Alternativas consideradas

- **Usar o SDK direto**: mais rápido agora, acoplamento caro depois — e testes dependeriam da rede.
- **Destination charges**: repasse automático pela Stripe, mas a Hypei perderia o controle do
  settlement, que é parte do produto.
