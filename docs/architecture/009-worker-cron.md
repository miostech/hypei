# ADR 009 — Worker por cron na Vercel

**Status:** aceito · **Data:** 2026-10-26 · **Fase:** 2

## Contexto

Três rotinas sustentam o sistema fora do caminho da requisição: liberar settlement
(`PENDING → AVAILABLE`), publicar o outbox e repetir webhooks que falharam. Elas viviam em
[`src/workers/index.ts`](../../src/workers/index.ts), um laço infinito rodado por `npm run worker`.

A hospedagem escolhida é a Vercel, onde não existe processo longo. Sem solução, a venda entra no
ledger como pendente e **o produtor nunca saca** — a falha mais cara possível, e silenciosa.

## Decisão

O trabalho vira **uma passada idempotente**, `runWorkerTick`, chamada por dois pontos de entrada:

- `npm run worker` — laço local, para desenvolvimento e para hospedagem com processo longo;
- `GET /api/cron/worker` — invocada pelo cron da Vercel, agendada em `vercel.json`.

A lógica mora em um lugar só. Trocar de hospedagem no futuro não reescreve o worker, troca quem
o chama.

### Por que isso é seguro sem coordenação

Cron pode disparar sobreposto, e invocações concorrentes não se atrapalham porque cada rotina já
era segura:

- o outbox reclama linhas com `UPDATE ... FOR UPDATE SKIP LOCKED`, e reclama de volta o que ficou
  preso em `PUBLISHING`;
- `settlePayment` trava a linha do pagamento na transação e sai se `settledAt` já existe, e o
  lançamento no ledger tem chave de idempotência;
- o processamento de webhook é idempotente por evento.

Verificado na prática: duas chamadas simultâneas devolveram zero liberações cada uma depois da
primeira passada, e o ledger continuou fechando em zero.

### Autenticação

A rota **falha fechada**. Sem `CRON_SECRET` configurado ela responde 503 e não roda nada — nunca
fica aberta. Com o segredo, compara o header `Authorization` em tempo constante. É assim que a
Vercel autentica o próprio cron.

Como consequência, `APP_ENV=production` passa a **recusar o boot sem `CRON_SECRET`**: sem ele o
worker não rodaria, e essa falha não apareceria em lugar nenhum até alguém reclamar que o saque
não libera.

## Consequências

- **O agendamento por minuto exige plano Pro.** No Hobby o cron é diário, e as três rotinas
  ficariam com um dia de atraso — inaceitável para o e-mail de compra confirmada e para o retry
  de webhook.
- Cada passada é limitada por lote (webhooks 50, outbox 100, settlement 500) e cabe no teto de
  60 segundos declarado em `maxDuration`. Se o volume crescer, o lote é o que se ajusta primeiro.
- A fila em memória fica ainda mais frágil em serverless: trabalho agendado depois da resposta
  pode nunca rodar. Hoje o cron cobre, porque `retryDue` reclama eventos `RECEIVED` presos, mas há
  latência de até um ciclo. A correção limpa é `after()` do `next/server` na rota de webhook.

## Alternativas consideradas

- **Processo longo em outra hospedagem** (Fly, Railway, VPS): mais simples de operar e sem limite
  de duração, mas contraria a escolha de hospedar na Vercel.
- **Fila gerenciada** (QStash, Inngest, SQS): resolve agendamento e retries com garantias
  melhores. É para onde ir se o cron por minuto ficar apertado — e exige implementar o driver de
  fila que hoje só existe como interface.
