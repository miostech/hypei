# ADR 010 — Destino do saque

**Status:** aceito · **Data:** 2026-11-04 · **Fase:** 2

## Contexto

Até aqui o saque chamava `provider.createPayout({ providerAccountId })` e pronto: quem decidia
para onde o dinheiro ia era a Stripe, na conta bancária que a produtora cadastrou no onboarding
dela. A Kabrun nunca soube o destino, e nem precisava saber.

Isso funciona na Europa e nos Estados Unidos. No Brasil não: produtora brasileira recebe por
**Pix**, não por transferência da conta conectada — é o que toda plataforma do mercado faz, e é
o que ela espera. A Stripe não faz Pix de saída.

O modelo `PayoutDestination` existia no schema desde o começo e nunca foi usado por linha
nenhuma de código: `Payout.destinationId` era sempre nulo.

## Decisão

**O destino depende do país da conta de recebimento.**

- Fora do Brasil, nada muda: quem paga é o provedor, na conta bancária que ele já conhece.
  `PayoutDestination` fica vazio e `Payout.destinationId` continua nulo.
- No Brasil, quem paga é a Kabrun, por Pix, e **a chave é condição do saque**. Sem ela,
  `request()` recusa antes de mexer no saldo: um saque sem destino tira dinheiro do saldo dela e
  não chega em lugar nenhum.

**A chave é guardada inteira**, ao contrário do documento em `TaxIdentity`. São coisas
diferentes: o documento só precisa ser conferido, e por isso dele guardamos só o hash e os
últimos dígitos; a chave é o endereço para onde o dinheiro vai, e sem ela não há como pagar. Em
log, auditoria e e-mail ela aparece mascarada ([`maskPixKey`](../../src/modules/payouts/pix-key.ts)).

**O tipo da chave não é perguntado, é deduzido do formato.** Um campo a menos para a produtora
errar. A ambiguidade real — onze dígitos podem ser CPF ou celular — é resolvida pelo dígito
verificador e pelos parênteses: se fecha como CPF é CPF, se não fecha é telefone, e `(11)` ou
`+55` decidem na hora.

**Chave de CPF/CNPJ precisa ser o documento da própria conta.** Conferimos pelo `valueHash` que
a identidade fiscal já guarda, então o documento continua sem nunca ser lido de volta. É a
checagem que mais paga: Pix cai na conta do titular da chave, e dinheiro que caiu na conta
errada não volta sozinho.

**O destino é congelado no saque.** `Payout.destinationId` aponta para a linha que valia quando
a solicitação foi registrada, e é essa que vai para o provedor no `dispatch`. Trocar a chave
depois não reescreve para onde o dinheiro de ontem foi.

**A Stripe recusa um destino Pix em vez de ignorá-lo.** `createPayout` lança quando recebe um
`destination`. Ignorar seria pior: o dinheiro sairia para a conta conectada enquanto a produtora
pediu Pix, e ninguém perceberia.

## Consequências

- Produtora brasileira sem chave cadastrada não saca. O Financeiro avisa e desabilita o botão,
  com link para Configurações; não é um erro que só aparece depois de clicar.
- **O trilho de Pix de saída ainda não existe.** O destino atravessa toda a camada de domínio e
  chega ao provedor, mas quem sabe pagar por Pix hoje é só o `MockPaymentProvider`. Entrar em
  produção no Brasil exige um PSP com Pix de saída (Asaas, Celcoin, Pagar.me, banco direto) por
  trás da mesma interface `PaymentProvider`.
- A titularidade só é conferida de verdade no DICT, que é do PSP. O que fazemos aqui é a
  pré-checagem que pega o erro mais comum — e que não depende de trilho nenhum para funcionar.
- `PayoutDestinationType.BANK_ACCOUNT` continua reservado. O dia em que algum país precisar de
  IBAN cadastrado fora do provedor, é a mesma tabela.

## Alternativas consideradas

- **Pix pela Stripe**: não existe. A Stripe faz Pix de *entrada* no Brasil, não de saída.
- **Perguntar o tipo da chave num select**: mais código na tela e mais um jeito de errar. O
  formato já carrega a informação, e o que ele não resolve — CPF contra celular — um select
  também não resolveria, porque a produtora erraria o select do mesmo jeito.
- **Guardar a chave mascarada, como o documento**: impossível. Sem a chave inteira não há saque.
- **Deixar a chave opcional e falhar no `dispatch`**: o saque já teria saído do saldo disponível
  e precisaria ser estornado. Recusar em `request()` custa um aviso; recusar no `dispatch` custa
  um lançamento de reversão e uma produtora sem entender para onde o dinheiro dela foi.
