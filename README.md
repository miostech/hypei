# Hypei

Plataforma global para venda de produtos digitais, cursos, comunidades, assinaturas e mentorias.

A Hypei **recebe o pagamento do comprador**, registra a venda no seu próprio ledger, cobra a taxa da
plataforma e **repassa o saldo ao produtor** quando o prazo de liberação vence. Ou seja: é uma
plataforma de pagamentos/marketplace, não uma loja com checkout integrado.

Mercados da Fase 1: **Brasil, União Europeia e Estados Unidos** (BRL, EUR, USD).

---

## Índice

- [Arquitetura](#arquitetura)
- [Stack](#stack)
- [PostgreSQL vs MongoDB](#postgresql-vs-mongodb)
- [Identidade (Keycloak)](#identidade-keycloak)
- [Multi-tenancy e autorização](#multi-tenancy-e-autorização)
- [Dinheiro](#dinheiro)
- [Arquitetura de pagamentos](#arquitetura-de-pagamentos)
- [Ledger](#ledger)
- [Balance](#balance)
- [Settlement](#settlement)
- [Payout](#payout)
- [Reembolsos e chargebacks](#reembolsos-e-chargebacks)
- [Webhooks e idempotência](#webhooks-e-idempotência)
- [Rodando localmente](#rodando-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Migrations, Mongo e Redis](#migrations-mongo-e-redis)
- [Stripe em desenvolvimento](#stripe-em-desenvolvimento)
- [Testes](#testes)
- [Estrutura de diretórios](#estrutura-de-diretórios)
- [Status da Fase 1](#status-da-fase-1)

---

## Arquitetura

Cada camada tem uma responsabilidade única, e elas nunca se misturam:

| Camada | Responsabilidade |
|---|---|
| **Keycloak** | Identidade: login, senha, recuperação, verificação de e-mail, sessão, MFA |
| **Hypei** | Autorização: quem pertence a qual organização e o que pode fazer |
| **PostgreSQL** | Fonte de verdade de commerce e finanças |
| **MongoDB** | Dados flexíveis: apresentação do checkout, eventos, payloads |
| **Redis** | Cache, locks, rate limit e (futuramente) filas |
| **Payment provider** | Movimentação real do dinheiro (Stripe) |
| **Ledger** | Fonte de verdade financeira da Hypei |
| **Balance** | Projeção do ledger (cache), nunca fonte de verdade |
| **Order** | Intenção comercial |
| **Payment** | Movimentação vinda do comprador |
| **Payout** | Movimentação indo para o produtor |

O fluxo de uma requisição:

```
Server Component / Server Action / Route Handler
        ↓  (Zod valida a entrada, requireUser/requireOrganization autoriza)
     Service            ← regra de negócio, um domínio por service
        ↓
   Repository           ← interface; a implementação Prisma/Mongo fica isolada
        ↓
PostgreSQL / MongoDB    ← operações financeiras sempre em transação
```

Serviços **nunca** importam `PrismaClient`, `MongoClient` ou o SDK da Stripe. Eles recebem
repositories e interfaces de provider (inversão de dependência), o que também torna os testes
determinísticos. A montagem fica em [`src/server/services.ts`](src/server/services.ts) e
[`src/server/container.ts`](src/server/container.ts).

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions) + React 19 + TypeScript strict
- **Tailwind CSS 4** + **shadcn/ui** + **Lucide**
- **Zod** para validação e **React Hook Form**/forms nativos progressivos
- **Keycloak** (OIDC Authorization Code + PKCE, implementado à mão com `jose`)
- **PostgreSQL 17** + **Prisma 7** (driver adapter `@prisma/adapter-pg`)
- **MongoDB 8** para documentos e eventos
- **Redis 7** para cache, locks e rate limit
- **Stripe** (Payments, Connect, Billing, Webhooks) — com `MockPaymentProvider` para desenvolvimento
- **Vitest** para testes (unitários + integração contra Postgres real)
- **Docker Compose** para a infraestrutura local

## PostgreSQL vs MongoDB

**PostgreSQL** é a fonte de verdade de tudo que é relacional e financeiro:
`User`, `Organization`, `OrganizationMember`, `Product`, `Offer`, `Checkout`, `Customer`, `Order`,
`OrderItem`, `Payment`, `Transaction`, `Subscription`, `Refund`, `Dispute`, `LedgerJournal`,
`LedgerEntry`, `Balance`, `Reserve`, `Payout`, `PayoutDestination`, `MerchantAccount`,
`SettlementPolicy`, `PlatformFeePolicy`, `Affiliate`, `Coupon`, `Course`, `Enrollment`,
`ApiKey`, `AuditLog`, `WebhookEvent`, `OutboxEvent`, `IdempotencyKey`.

**MongoDB** guarda o que é flexível, volumoso ou muda de forma com frequência:
`checkout_configs` (versionado), `analytics_events`, `webhook_payloads`, `provider_snapshots`,
`activity_events`, `risk_events`.

Regra que não se quebra: **dado financeiro nunca tem o MongoDB como única fonte de verdade**.
O preço oficial vem sempre da `Offer` no PostgreSQL; o Mongo só configura a apresentação.

## Identidade (Keycloak)

Realm `hypei`, client `hypei-web` (confidencial, PKCE S256). A Hypei **não armazena senhas**:
a tabela `User` guarda `keycloakUserId` (único), e-mail, nome e preferências.

- `GET /api/auth/login` inicia o fluxo (state + nonce + PKCE em cookie assinado de 10 min)
- `GET /api/auth/callback` valida state/nonce, troca o code, verifica o ID token via JWKS e cria a sessão
- `POST /api/auth/logout` limpa a sessão e encerra a sessão no Keycloak (RP-initiated logout)

A sessão é um JWT HS256 em cookie `httpOnly`, `SameSite=Lax` (e `Secure` em produção).
O [`src/proxy.ts`](src/proxy.ts) faz apenas a checagem otimista (existe sessão válida?);
a autorização real acontece no servidor, em cada página e action.

## Multi-tenancy e autorização

Toda entidade de negócio carrega `organizationId`, e **todo repositório filtra por ele**.

Helpers: `getCurrentUser()`, `requireUser()`, `requireOrganization()`, `requireRole()`,
`requirePermission()`. O `organizationId` que chega do cliente (cookie, formulário, URL) nunca é
confiado: o vínculo é sempre reconferido no banco.

Papéis: `OWNER`, `ADMIN`, `FINANCE`, `SUPPORT`, `MARKETING`, `VIEWER` (mapeados para permissões em
[`permissions.ts`](src/modules/organizations/permissions.ts)), mais o papel global `PLATFORM_ADMIN`
para a equipe Hypei (`/admin`).

## Dinheiro

Nunca usamos float. Todo valor é **inteiro (bigint) em unidades menores** + moeda:

```ts
money(1090, "BRL")   // R$ 10,90
money(2999, "USD")   // US$ 29,99
```

Helpers em [`src/lib/money`](src/lib/money): `formatMoney`, `addMoney`, `subtractMoney`,
`calculatePercentage` (em basis points), `allocateProportionally` (rateio sem perder centavos),
`parseDecimalToMinorUnits`, `convertMinorUnits`. Operar entre moedas diferentes lança
`CurrencyMismatchError` — conversão precisa ser explícita.

## Arquitetura de pagamentos

```
Comprador → Checkout Hypei → PaymentProvider → PaymentIntent
                                    ↓
                          pagamento confirmado (webhook)
                                    ↓
   Hypei Ledger → Saldo pendente do produtor → Settlement → Saldo disponível
                                    ↓
                        Payout → conta bancária do produtor
```

A regra mais importante: **o frontend nunca confirma pagamento**. Um `Payment` só vira `PAID`
depois de um evento verificado do provedor. O retorno do navegador serve só para mostrar status.

A interface [`PaymentProvider`](src/lib/providers/payment/types.ts) isola o domínio do SDK:

```
OrderService → PaymentService → PaymentProvider → StripePaymentProvider
                                                 └ MockPaymentProvider (dev/testes)
```

`PAYMENT_PROVIDER=stripe|mock` decide qual usar. O mock é determinístico, não move dinheiro e
**emite webhooks assinados** — o fluxo de confirmação é idêntico ao de produção.

Stripe: `StripePaymentProvider` + `StripeConnectService` (contas conectadas, onboarding hospedado).
Cada produtor tem um `MerchantAccount` (entidade genérica, não "StripeAccount") cujo status interno
(`PENDING`, `REQUIRES_ACTION`, `UNDER_REVIEW`, `ACTIVE`, `RESTRICTED`, `DISABLED`) é derivado de
`charges_enabled`, `payouts_enabled`, `details_submitted` e dos `requirements` — nunca de um booleano só.

## Ledger

Partida dobrada desde o primeiro dia. Um `LedgerJournal` agrupa `LedgerEntry` e só é aceito se
**débitos == créditos**. Entries são **imutáveis**: o repositório não expõe update nem delete, e
correções são novos lançamentos.

Contas: `PLATFORM_CASH`, `PRODUCER_PENDING`, `PRODUCER_AVAILABLE`, `PLATFORM_REVENUE`,
`PROCESSOR_FEES`, `REFUNDS`, `CHARGEBACKS`, `RESERVES`, `TAXES`, `PAYOUTS`.

Venda de R$ 100,00 com R$ 4,00 de taxa de processamento e R$ 10,00 de taxa Hypei:

| Conta | Direção | Valor |
|---|---|---|
| `PLATFORM_CASH` | DEBIT | 10000 |
| `PROCESSOR_FEES` | CREDIT | 400 |
| `PLATFORM_REVENUE` | CREDIT | 1000 |
| `PRODUCER_PENDING` | CREDIT | 8600 |

Toda movimentação passa pelo `LedgerService`, com `idempotencyKey` por evento financeiro
(`payment:{id}:captured`, `payment:{id}:settled`, `refund:{id}`, `payout:{id}:paid`…). Repetir a
mesma chave é no-op — é isso que impede um webhook duplicado de criar dinheiro.

## Balance

`Balance` (pendente / disponível / reservado por organização e moeda) é **projeção** recalculada a
partir do ledger dentro da mesma transação do lançamento. Nunca fazemos `balance += x`, e o saldo
**não** é a soma das `Orders` (isso ignoraria taxas, reembolsos e chargebacks).

## Settlement

Depois da venda confirmada, o valor do produtor entra como **pendente**. A liberação segue a
`SettlementPolicy` (D+2, D+7, D+14, D+30…), resolvida por organização → país → padrão global.
Nada é hardcoded: as políticas são dados (veja [`prisma/seed.ts`](prisma/seed.ts)).

Ter saldo disponível na Stripe não libera nada: o settlement interno da Hypei é independente.

```bash
npm run settlement:run        # libera o que já venceu
npm run settlement:simulate   # finge que a janela passou (desenvolvimento)
```

## Payout

```
Produtor → valida MerchantAccount (ACTIVE + payoutsEnabled)
         → valida saldo disponível (lock da linha de Balance + leitura do ledger)
         → valida mínimo por moeda
         → cria Payout + lançamento (AVAILABLE → PAYOUTS)
         → provider (idempotency key payout:{id})
         → webhook → PAID (PAYOUTS → PLATFORM_CASH)
```

O que a plataforma **não permite**: saque acima do disponível, saque usando saldo pendente ou
reservado, saque duplicado por retry, saque para conta não verificada, e marcar como pago sem
confirmação do provedor. Falha ou cancelamento gera lançamento compensatório que devolve o valor
ao saldo disponível.

## Reembolsos e chargebacks

- **Reembolso**: reverte proporcionalmente a parte do produtor e a taxa Hypei; a taxa de
  processamento não devolvida pelo PSP é absorvida pela plataforma (conta `REFUNDS`). Nunca é
  possível reembolsar mais do que foi pago, nem duas vezes com a mesma chave.
- **Disputa**: ao abrir, a parte do produtor vai para `RESERVES`. Ganhou, volta para o produtor;
  perdeu, sai do caixa da plataforma (`CHARGEBACKS`) e o pagamento vira `CHARGEBACK`.
- Saldo negativo só pode acontecer por reversão (reembolso/chargeback), nunca por saque — e isso é
  regra explícita do domínio, não um efeito colateral.

## Webhooks e idempotência

Endpoint (`POST /api/webhooks/stripe`, `POST /api/webhooks/mock`) faz apenas:

1. lê o corpo **cru**; 2. valida a assinatura; 3. grava o payload (Mongo) e o evento (Postgres,
único por `provider + providerEventId`); 4. enfileira; 5. responde 2xx.

O processamento pesado roda no worker, com backoff e retry. Há três camadas de proteção contra
duplicidade: unicidade do evento, `claim` atômico no processamento e `idempotencyKey` do journal.

Mudanças de estado importantes gravam um `OutboxEvent` **na mesma transação** (transactional
outbox), e o worker publica os eventos de domínio depois — sem o risco de "banco atualizou, evento
não saiu".

## Rodando localmente

Pré-requisitos: Node 22+, Docker (Docker Desktop, OrbStack ou Colima).

```bash
cp .env.example .env
```

Gere os dois segredos locais (`SESSION_SECRET` e `DATA_HASH_SECRET`):

```bash
openssl rand -base64 48
```

Suba a infraestrutura (PostgreSQL, MongoDB, Redis, Keycloak + banco próprio):

```bash
npm run infra:up
```

Instale, prepare os bancos e rode:

```bash
npm install && npm run db:deploy && npm run db:seed && npm run mongo:setup && npm run dev
```

Confira se tudo está no ar:

```bash
npm run check:infra
```

Aplicação: <http://localhost:3100> · Keycloak: <http://localhost:8080> (admin/admin)

Usuários de desenvolvimento do realm: `producer@hypei.dev` e `admin@hypei.dev` (este com o papel
`platform_admin`), senha `hypei-dev-123`.

O worker de background (retry de webhooks, outbox e settlement) roda separado:

```bash
npm run worker
```

> **MongoDB local roda sem autenticação**, preso a `127.0.0.1` (o `mongosh` do container falha em
> alguns kernels virtualizados, o que quebra o bootstrap do usuário). Em staging/produção o Mongo
> precisa subir com autenticação.

## Variáveis de ambiente

Todas em [`.env.example`](.env.example), validadas com Zod no boot ([`src/lib/env.ts`](src/lib/env.ts)).
Destaques: `DATABASE_URL`, `MONGODB_URI`, `REDIS_URL`, `KEYCLOAK_*`, `APP_URL`, `SESSION_SECRET`,
`DATA_HASH_SECRET`, `PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_CLIENT_ID`, `STORAGE_PROVIDER`, `EMAIL_PROVIDER`, `QUEUE_DRIVER`.

Segredos nunca são commitados. A chave secreta da Stripe é exclusivamente server-side, e o app se
recusa a subir com chave `sk_live_` fora de produção.

## Migrations, Mongo e Redis

```bash
npm run db:migrate     # cria migration em desenvolvimento
npm run db:deploy      # aplica migrations (CI/produção)
npm run db:seed        # políticas de settlement e de taxa
npm run db:studio      # Prisma Studio
npm run mongo:setup    # cria collections e índices
```

Redis é usado hoje para rate limit do checkout; filas e locks distribuídos entram com o BullMQ.

## Stripe em desenvolvimento

Use **sempre** chaves de teste. Preencha `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` e
`STRIPE_WEBHOOK_SECRET` no `.env`, e mude `PAYMENT_PROVIDER=stripe`.

Encaminhe os webhooks com a Stripe CLI (não dependa de webhook configurado no dashboard para local):

```bash
stripe listen --forward-to localhost:3100/api/webhooks/stripe
```

O `STRIPE_WEBHOOK_SECRET` é o `whsec_…` que o comando imprime. Para eventos de contas conectadas,
acrescente `--events account.updated,payout.paid,payout.failed` ou use `stripe listen --latest`.

## Testes

```bash
npm test           # 68 testes
npm run verify     # lint + typecheck + testes
```

Os testes de integração usam o banco `hypei_test` (criado pelo Docker Compose) e rodam contra
PostgreSQL de verdade — é assim que validamos transações, locks e restrições de unicidade.

Cobertura atual: money, cálculo de taxas, ledger (balanceamento, imutabilidade, idempotência),
fluxo financeiro completo, projeção do balance, settlement, payouts (duplicidade, saldo
insuficiente, concorrência, conta não verificada, falha e estorno), reembolsos (total, parcial,
duplicado, acima do pago), disputas (reserva, ganha, perdida), idempotência de webhook (mesmo
evento duas vezes ⇒ um único lançamento), assinatura inválida, eventos fora de ordem, isolamento de
tenant, autorização, checkout e o provider Stripe (PaymentIntent, assinatura, fee real, mapeamentos).

## Estrutura de diretórios

```
src/
  app/            rotas (App Router): landing, (app) dashboard, checkout público,
                  members, admin, onboarding, api/{auth,webhooks,health}
  components/     ui/ (shadcn), layout/ (sidebar, topbar), shared/, brand/
  modules/        um diretório por domínio — auth, organizations, products, offers,
                  checkout, customers, orders, payments, transactions, ledger, balances,
                  settlements, payouts, refunds, disputes, subscriptions, merchant-accounts,
                  members, analytics, webhooks, risk, compliance, taxes, fees, audit, integrations
                  (cada um com service, repository, schemas)
  lib/            money/, errors/, env, logger/, clock, actions/, security/, idempotency/,
                  events/ (domain event, event bus, outbox), database/{postgres,mongo,redis},
                  providers/{payment,email,storage,queue}, stripe/, ui/
  server/         repositories.ts, unit-of-work.ts, services.ts, container.ts, actions/
  workers/        worker de background
prisma/           schema, migrations, seed
docker/           realm do Keycloak, init do Postgres
docs/architecture ADRs
tests/            unit/, integration/, support/
```

## Status da Fase 1

Funciona de ponta a ponta: **login no Keycloak → onboarding → produto → oferta → checkout →
compra no checkout público → webhook assinado → pagamento PAID → ledger → saldo pendente →
settlement → saldo disponível → saque → payout pago**, com o ledger fechando em cada etapa.

Ainda não implementado (fases seguintes): assinaturas recorrentes de ponta a ponta, afiliados,
cupons, editor de conteúdo da área de membros, upload para storage S3, telas internas do `/admin`,
KYC/AML real, impostos (NF-e, VAT/OSS, sales tax), API pública e filas em BullMQ/Redis Streams.

Decisões arquiteturais estão registradas em [`docs/architecture`](docs/architecture).
