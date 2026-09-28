# ADR 001 — Estratégia de bancos de dados

**Status:** aceito · **Data:** 2026-09-22 · **Fase:** 1

## Contexto

A Ripay precisa de garantias transacionais fortes para dinheiro e, ao mesmo tempo, de flexibilidade
para dados que mudam de formato com frequência (configuração de checkout, eventos de tracking,
payloads de provedores). Usar só um banco obrigaria a escolher entre rigidez onde ela atrapalha ou
frouxidão onde ela é inaceitável.

## Decisão

Dois bancos, com fronteiras explícitas.

**PostgreSQL** é o sistema de registro de identidade, commerce e finanças. Tudo que precisa de
transação, unicidade, integridade referencial ou auditoria vive nele.

**MongoDB** guarda dados documentais e de alto volume: `checkout_configs`, `analytics_events`,
`webhook_payloads`, `provider_snapshots`, `activity_events`, `risk_events`.

Regras que não se quebram:

1. Dado financeiro **nunca** tem o MongoDB como única fonte de verdade.
2. O preço cobrado vem sempre da `Offer` (PostgreSQL). O Mongo configura apresentação.
3. Acesso ao Mongo passa por repositories próprios; nenhum componente React fala com o driver.
4. Operações financeiras relacionadas acontecem numa única transação PostgreSQL.

Quando um fluxo escreve nos dois (criar checkout), o Mongo é gravado primeiro: se o Postgres
falhar depois, sobra um documento órfão inofensivo — o contrário deixaria um checkout sem
apresentação.

## Consequências

- Duas infraestruturas para operar, monitorar e fazer backup.
- Consistência entre os bancos é eventual; por isso nada financeiro depende do Mongo.
- Ganhamos versionamento barato de checkout e ingestão de eventos sem migrations.

## Alternativas consideradas

- **Só PostgreSQL** (com `jsonb`): menos infraestrutura, mas mistura dados operacionais de alto
  volume com o banco financeiro e pressiona o mesmo storage.
- **Só MongoDB**: inaceitável para o ledger, que depende de transações e unicidade.
