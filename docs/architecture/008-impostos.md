# ADR 008 — Imposto na venda

**Status:** aceito · **Data:** 2026-10-26 · **Fase:** 2

## Contexto

A Kabrun vende em Brasil, União Europeia e Estados Unidos. Até aqui o imposto existia só
como contrato: `TaxService` com um `NoTaxService` devolvendo zero, `Order.taxAmount` gravado
como `0n` fixo, e uma conta `TAXES` no ledger que nunca recebeu lançamento.

Imposto calculado errado não dá erro — vira passivo. Então as três perguntas que decidem o
desenho precisavam ser respondidas antes de qualquer código.

## Decisão

**Quem vende é o produtor.** A Kabrun calcula, registra e mostra o imposto; o recolhimento é
obrigação dele. A plataforma não se torna contribuinte e não precisa de inscrição fiscal em
cada jurisdição onde um produtor vende.

A consequência mais importante disso é contábil: **o imposto não gera lançamento no ledger.**
Nenhum dinheiro muda de mãos por causa dele. O valor cheio continua indo para o produtor, e o
que registramos é apenas quanto daquilo é tributo. A conta `TAXES` fica reservada para o dia
em que a plataforma for a responsável — regras de *deemed supplier* na UE ou de *marketplace
facilitator* nos EUA podem impor isso, e aí o desenho muda.

**O preço anunciado já inclui o imposto.** A alíquota é extraída de dentro do total pago, nunca
somada a ele: `imposto = bruto × bps / (10000 + bps)`. É o padrão de consumidor no Brasil e na
UE, e garante que o comprador pague exatamente o preço que viu. A primitiva está em
[`extractIncludedPercentage`](../../src/lib/money/money.ts), separada de `calculatePercentage`
justamente porque confundir as duas superfatura o imposto.

**A alíquota é configuração do produtor, não adivinhação nossa.** `TaxPolicy` segue a mesma
precedência das outras políticas — organização → país → padrão global — e carrega regime,
alíquota em basis points e jurisdição. Sem política ativa, nada é cobrado: silêncio não vira
imposto. O regime aplicado é congelado em `Order.taxRegime`, para que mudar a política depois
não reescreva vendas passadas.

Isso é deliberado: no Brasil a carga depende do regime do produtor (Simples Nacional, ISS
municipal, MEI) e da faixa de faturamento dele. A plataforma não tem como saber, e errar para
mais é cobrar imposto que não existe.

## Consequências

- O comprador nunca paga mais do que o preço anunciado.
- O ledger continua fechando sem o imposto participar, o que mantém a conciliação simples.
- O produtor precisa de uma tela para configurar o próprio regime; enquanto ela não existe, a
  política é criada direto no banco e o padrão é não cobrar nada.
- Emissão de documento fiscal (NFS-e no Brasil) **não** está incluída. É integração com emissor
  terceirizado e entra atrás da mesma interface.
- UE e EUA ainda não têm motor. O `PolicyTaxService` serve qualquer jurisdição de alíquota
  embutida; VAT com OSS e reverse charge, e sales tax com nexo, precisam de regras próprias —
  provavelmente Stripe Tax, já que o provedor de pagamento é a Stripe.

## Alternativas consideradas

- **Plataforma como responsável pelo recolhimento**: é o que a descrição original da conta
  `TAXES` sugeria. Dá mais controle e muito mais exposição — exige inscrição fiscal, apuração e
  repasse em cada jurisdição. Pode voltar à mesa se regras de marketplace obrigarem.
- **Imposto somado no checkout**: prática dos EUA. Rejeitado por ora porque o mercado inicial é
  o Brasil, onde o consumidor espera o preço final anunciado.
- **Comprar cálculo de terceiros desde o começo** (Stripe Tax, Avalara): resolve UE e EUA, não
  resolve NFS-e no Brasil, e custa por transação. O encanamento construído aqui é o mesmo que
  esses provedores vão usar quando entrarem.
