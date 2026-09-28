# ADR 005 — Ledger financeiro

**Status:** aceito · **Data:** 2026-09-22 · **Fase:** 1

## Contexto

Saldo de produtor calculado a partir de `Orders`, ou incrementado direto numa coluna, é a origem
clássica de divergência financeira: ignora taxas, reembolsos, chargebacks e retries, e não explica
como chegou naquele número.

## Decisão

Um ledger de partida dobrada como **fonte de verdade financeira**.

- `LedgerJournal` agrupa `LedgerEntry` e só é gravado se **débitos == créditos**.
- Entries são **imutáveis**: o repositório não expõe update nem delete. Correção é novo journal.
- Cada evento financeiro tem uma `idempotencyKey` única (`payment:{id}:captured`,
  `payment:{id}:settled`, `refund:{id}`, `dispute:{id}:hold`, `payout:{id}:paid`…). Repetir é no-op.
- Toda movimentação passa pelo `LedgerService`, dentro da mesma transação da mudança de estado.
- O journal guarda `paymentId`, o que permite derivar do próprio ledger quanto ainda está pendente
  de cada venda — sem coluna paralela que possa divergir.

Plano de contas: `PLATFORM_CASH` (ativo), `PRODUCER_PENDING`, `PRODUCER_AVAILABLE`, `RESERVES`,
`PAYOUTS`, `PROCESSOR_FEES` (passivos), `PLATFORM_REVENUE` (receita), `REFUNDS`, `CHARGEBACKS`
(despesas), `TAXES`.

Política de reembolso (explícita): parte do produtor e taxa Ripay são revertidas proporcionalmente;
a taxa de processamento que o PSP não devolve é absorvida pela plataforma (`REFUNDS`). Em chargeback
perdido, a perda vai para `CHARGEBACKS`.

Saldo negativo é permitido **apenas** por reversão (reembolso/chargeback) e nunca por saque.

## Consequências

- Toda operação financeira exige pensar em contas e direções — mais disciplina, menos surpresa.
- Auditoria e conciliação ficam triviais: dá para reconstruir qualquer saldo a partir das entries.
- Os testes verificam a equação contábil a cada etapa: dinheiro não é criado nem perdido.

## Alternativas consideradas

- **Coluna de saldo com incremento**: simples e frágil; um retry duplica dinheiro.
- **Somar Orders**: mistura intenção comercial com realidade financeira e ignora taxas e reversões.
