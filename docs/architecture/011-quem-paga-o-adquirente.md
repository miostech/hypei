# ADR 011 — Quem paga a taxa do adquirente

**Status:** aceito · **Data:** 2026-11-06 · **Fase:** 2

## Contexto

A landing page anuncia **8,99% + R$ 2,49 por venda**. O código cobrava outra coisa:

```ts
// fee.calculator.ts, antes
const beforeCommission = subtractMoney(subtractMoney(gross, processorFee), platformFee);
```

A taxa do adquirente saía do produtor, somada à taxa da Kabrun. Numa venda de R$ 100,00 com a
Stripe cobrando ~4%, o produtor recebia R$ 86,61 — ou seja, pagava **13,4%**, não os 8,99% que
a página promete. Ele via as duas linhas no detalhe da venda, uma embaixo da outra, e nenhuma
delas era o número que o fez se cadastrar.

Pior do que caro: **imprevisível**. A taxa do adquirente varia por bandeira, por parcelamento,
por país do cartão e por acordo comercial da Kabrun com o PSP. O mesmo produto, vendido pelo
mesmo preço, pagava taxas diferentes em dias diferentes — por um motivo que o produtor não
controla, não vê e não pode negociar.

No mercado isso não existe. Kiwify, Hotmart e Eduzz cobram **uma** taxa anunciada e bancam a
adquirência por dentro. O produtor sabe de cor quanto recebe por venda.

## Decisão

**O produtor paga só a taxa que a Kabrun anuncia. A adquirência é custo da Kabrun, pago com
essa taxa, e a diferença é o lucro.**

```
venda 10000
  − taxa Kabrun  1000   → receita da Kabrun
  = produtor     9000   ← o que a página dele prometeu

taxa Kabrun      1000
  − adquirente    400   → despesa da Kabrun
  = lucro         600
```

A divisão em [`fee.calculator.ts`](../../src/modules/fees/fee.calculator.ts) passou a ser
`gross = platformFee + affiliateCommission + producerNet`, sem o adquirente. O campo
`processorFeeAmount` **continua no `FeeBreakdown` e no `Payment`**: é o custo real que a Stripe
informa em `balanceTransaction.fee`, e é o que separa receita de lucro. Ele só não desconta de
quem vendeu.

### No ledger

`PROCESSOR_FEES` deixou de ser passivo e virou **despesa** (`DEBIT` em
[`ledger.accounts.ts`](../../src/modules/ledger/ledger.accounts.ts)). O lançamento da captura
reflete o que acontece de verdade com o dinheiro — o adquirente retém a taxa dele **antes** de
repassar:

| Conta            | Lado   | Valor |
| ---------------- | ------ | ----- |
| PLATFORM_CASH    | DEBIT  | 9600  |
| PROCESSOR_FEES   | DEBIT  | 400   |
| PLATFORM_REVENUE | CREDIT | 1000  |
| PRODUCER_PENDING | CREDIT | 9000  |

Entra em caixa o líquido, porque é só isso que chega na conta. A venda devolvida reclassifica a
despesa em par que fecha sozinho (`REFUNDS` a débito, `PROCESSOR_FEES` a crédito): o custo de
adquirência de uma venda que rendeu sai de "custo da receita" e vira "perda" — a receita que o
cobria foi estornada, mas a taxa ficou com o adquirente. O caixa termina **negativo** nessa
venda (recebeu 9600, devolveu 10000), e é exatamente o que a Kabrun perdeu nela.

### No admin

`/admin/revenue` mostra, por moeda: taxas cobradas, pago ao adquirente, perdido em devolução e
chargeback, e o **lucro líquido**. É a conta que antes não existia em lugar nenhum: a plataforma
sabia quanto faturava e não sabia quanto sobrava. `/admin/organizations` ganhou quanto cada
organização vendeu e quanta taxa gerou.

### Venda que dá prejuízo

Se o adquirente custar mais do que a taxa — venda pequena, cartão internacional, parcelamento
longo —, a venda **passa**. O ledger registra, o lucro líquido do admin mostra negativo e a
decisão é comercial: mudar a taxa publicada, mudar o acordo com o PSP ou aceitar. Recusar a
venda no `calculateFeeBreakdown` seria derrubar a compra de um comprador por um custo que não é
dele e que ninguém na operação pediu para evitar.

## Consequências

- **Margem variável.** A Kabrun absorve a variação de bandeira, parcelamento e país. É o preço
  de um número que o produtor entende, e é a razão de a taxa internacional ser 9,99% + $0,80:
  dólar e euro têm adquirência mais cara e chargeback mais frequente.
- **A taxa publicada passou a ter piso.** `PUBLISHED_PLATFORM_FEE` não é mais só marketing: é o
  que paga a Stripe. Mexer nela sem olhar o custo do PSP come o lucro direto.
- O detalhe da venda tem uma linha a menos. O produtor vê cobrado, taxa Kabrun e líquido — três
  números que fecham na mão.
- `FinanceSummary.processorFees` foi removido: não é custo do produtor, então não entra no
  resumo dele. A `grossRevenue` passou a somar as duas pernas do débito (caixa + despesa),
  porque ler só o caixa mostrava 4% menos do que ele vendeu.
- O produtor com condição negociada continua funcionando: a verdade final é a
  `PlatformFeePolicy` no banco, e `PUBLISHED_PLATFORM_FEE` é só o padrão que o seed grava.

## Alternativas consideradas

- **Repassar o custo real, mostrando as duas taxas** (o que havia): honesto na contabilidade e
  inutilizável no comercial. O produtor não consegue prever quanto recebe, e o número da landing
  page nunca é o número do extrato.
- **Repassar uma taxa de adquirência fixa estimada** (ex.: sempre 4%): o produtor volta a pagar
  mais do que o anunciado, e a Kabrun ainda fica com a variação — o pior dos dois mundos, com a
  complexidade de manter a estimativa.
- **Embutir a adquirência no percentual e cobrar os dois do produtor**: é a mesma coisa que
  cobrar mais caro, só sem dizer. A página passaria a anunciar ~13% para entregar o que hoje
  entrega com 8,99%, e nenhum concorrente anuncia isso.
- **Recusar a venda em que o adquirente custa mais do que a taxa**: perde-se a venda do produtor
  por um custo interno da plataforma. Se isso acontecer em volume, o problema é a taxa ou o
  contrato com o PSP, e nenhum dos dois se resolve derrubando checkout.
