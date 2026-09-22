# ADR 007 — Arquitetura orientada a eventos

**Status:** aceito · **Data:** 2026-09-22 · **Fase:** 1

## Contexto

Pagamento confirmado dispara vários efeitos: liberar acesso, avisar o comprador, atualizar
analytics, notificar integrações. Fazer tudo dentro do request do webhook deixa o endpoint lento e
frágil — e um erro no e-mail não pode desfazer um lançamento contábil.

## Decisão

Três mecanismos com papéis distintos.

**1. Ingestão de webhook (HTTP):** receber corpo cru → validar assinatura → persistir payload
(Mongo) e evento (Postgres, único por `provider + providerEventId`) → enfileirar → responder 2xx.
Nenhuma regra financeira roda no request.

**2. Processamento (worker):** consome a fila, traduz para eventos normalizados e chama os serviços
de domínio. Cada handler é idempotente, eventos podem chegar fora de ordem, e falhas viram retry com
backoff exponencial (até 8 tentativas). O `claim` do evento é atômico, então dois workers não
processam o mesmo evento.

**3. Transactional outbox:** mudanças de estado importantes gravam um `OutboxEvent` **na mesma
transação**. Um publisher lê os pendentes e publica no `EventBus`. Isso elimina o cenário "banco
atualizou mas o evento não saiu" e garante entrega ao menos uma vez.

Eventos de domínio: `order.created`, `payment.created`, `payment.paid`, `payment.failed`,
`refund.created`, `refund.completed`, `settlement.released`, `payout.requested`, `payout.paid`,
`payout.failed`, `dispute.created`, `dispute.closed`, `merchant_account.updated`, entre outros.

As abstrações `JobQueue` e `EventBus` têm implementação in-process na Fase 1. Trocar por
BullMQ ou Redis Streams é implementar a interface e mudar `QUEUE_DRIVER` — publishers e
subscribers não mudam.

## Consequências

- Webhook responde rápido e o provedor não fica reenviando por timeout.
- Consumidores precisam ser idempotentes (é requisito, não recomendação).
- Entrega "ao menos uma vez" significa que o mesmo evento pode ser processado duas vezes; a
  idempotência do ledger (ADR 005) é a rede de proteção final.
- Na Fase 1 a fila é in-process: se o processo cair entre persistir e processar, o worker recupera
  pelos eventos `RECEIVED` antigos e pelos `FAILED` com retry pendente.
