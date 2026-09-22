# ADR 006 — Onde cada dado mora (PostgreSQL vs MongoDB)

**Status:** aceito · **Data:** 2026-09-22 · **Fase:** 1

## Contexto

O ADR 001 definiu usar os dois bancos. Falta o critério prático: diante de um dado novo, onde ele vai?

## Decisão

O dado vai para o **PostgreSQL** se qualquer uma for verdadeira:

- é dinheiro, ou entra em cálculo de dinheiro;
- precisa de transação junto com outra escrita;
- precisa de unicidade, integridade referencial ou auditoria;
- é usado para autorização ou isolamento de tenant.

O dado vai para o **MongoDB** se todas forem verdadeiras:

- o formato muda com frequência ou varia por produtor;
- é apresentação, evento, telemetria ou cópia de payload externo;
- perdê-lo não impede a operação financeira de estar correta.

### Aplicação

| Dado | Banco | Por quê |
|---|---|---|
| Preço da oferta | PostgreSQL | é dinheiro |
| Headline, cor, campos do checkout | MongoDB | apresentação, muda sempre |
| Pedido, pagamento, ledger, saldo, saque | PostgreSQL | financeiro e transacional |
| Evento de webhook (id, status) | PostgreSQL | deduplicação precisa de unicidade |
| Payload cru do webhook | MongoDB | volumoso, formato do provedor |
| Eventos de checkout e UTMs | MongoDB | alto volume, análise |
| Status da conta de recebimento | PostgreSQL | controla se pode sacar |
| Snapshot completo da conta no provedor | MongoDB | diagnóstico |

### Versionamento do checkout

`checkout_configs` guarda uma versão por alteração (`checkoutId` + `version` únicos). A `Order`
registra `checkoutId` e `checkoutVersion`, então sempre dá para saber qual versão o comprador viu —
mesmo que o produtor mude a página depois da venda. O vínculo relacional e o slug ficam no
PostgreSQL (`Checkout`), com `currentVersion` apontando para a versão ativa.

## Consequências

- A regra é objetiva o bastante para decidir sem discussão caso a caso.
- Quando um dado do Mongo começa a influenciar dinheiro, ele precisa migrar para o PostgreSQL — e
  isso é um sinal de alerta, não uma conveniência.
