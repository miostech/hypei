import { randomUUID } from "node:crypto";
import type { Locale } from "@/lib/i18n/locale";
import type { PrismaClient } from "@/generated/prisma/client";
import type { PaymentMethodType } from "@/generated/prisma/enums";
import { createPrismaClient } from "@/lib/database/postgres/client";
import { InProcessEventBus } from "@/lib/events/event-bus";
import { DEVELOPMENT_RATES, FixedExchangeRateProvider, type RateTable } from "@/lib/providers/exchange";
import { MockPaymentProvider, type MockEvent } from "@/lib/providers/payment/mock/mock-payment-provider";
import { InMemoryAnalyticsEventRepository } from "@/modules/analytics/analytics-event.repository";
import { InMemoryCheckoutConfigRepository } from "@/modules/checkout/checkout-config.repository";
import { InMemoryWebhookPayloadRepository } from "@/modules/webhooks/webhook-payload.repository";
import { buildServices, type Services } from "@/server/services";
import { FakeEmailProvider } from "./fake-email-provider";
import { FakeStorageProvider } from "./fake-storage-provider";
import { ManualQueue } from "./manual-queue";

export const VALID_CPF = "529.982.247-25";

let sharedPrisma: PrismaClient | undefined;
export function testPrisma(): PrismaClient {
  sharedPrisma ??= createPrismaClient(process.env.TEST_DATABASE_URL!);
  return sharedPrisma;
}

export async function resetDatabase(prisma = testPrisma()) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
}

export interface TestApp {
  prisma: PrismaClient;
  services: Services;
  mock: MockPaymentProvider;
  email: FakeEmailProvider;
  storage: FakeStorageProvider;
  queue: ManualQueue;
  clock: { now: Date; advanceDays(days: number): void };
  deliver(event: MockEvent, eventId?: string): Promise<{ duplicate: boolean }>;
}

export async function createTestApp(
  options: {
    platformFeeBps?: number;
    settlementDays?: number;
    processorFeeBps?: number;
    payoutFee?: bigint;
    /** Sem reserva por padrão: cada teste de saldo fala de uma coisa só. Quem testa a
     *  reserva liga a dela, e o padrão publicado tem teste próprio. */
    reserveBps?: number;
    reserveHoldDays?: number;
    /** Cotações desta instância, para o teste de saque com conversão. */
    rates?: RateTable;
  } = {},
): Promise<TestApp> {
  const prisma = testPrisma();
  await resetDatabase(prisma);

  await prisma.platformFeePolicy.create({ data: { currency: "BRL", percentageBps: options.platformFeeBps ?? 1000, fixedAmount: 0n } });
  await prisma.settlementPolicy.create({ data: { delayDays: options.settlementDays ?? 7 } });
  await prisma.reservePolicy.create({
    data: { percentageBps: options.reserveBps ?? 0, holdDays: options.reserveHoldDays ?? 30 },
  });

  const clock = {
    // Provider events carry real timestamps, so the test clock starts at "now".
    now: new Date(),
    advanceDays(days: number) {
      this.now = new Date(this.now.getTime() + days * 86_400_000);
    },
  };
  const mock = new MockPaymentProvider({ webhookSecret: "test-secret", processorFeeBps: options.processorFeeBps ?? 400 });
  const queue = new ManualQueue();
  const email = new FakeEmailProvider();
  const storage = new FakeStorageProvider();
  // Cotações fixas: o teste que converte sabe exatamente que número esperar.
  const exchangeRates = new FixedExchangeRateProvider(options.rates ?? DEVELOPMENT_RATES, () => clock.now, "test");

  const services = buildServices({
    prisma,
    paymentProvider: mock,
    webhookProviders: { MOCK: mock },
    mongo: {
      checkoutConfigs: new InMemoryCheckoutConfigRepository(),
      analyticsEvents: new InMemoryAnalyticsEventRepository(),
      webhookPayloads: new InMemoryWebhookPayloadRepository(),
    },
    queue,
    eventBus: new InProcessEventBus(),
    emailProvider: email,
    storageProvider: storage,
    exchangeRates,
    clock: () => clock.now,
    config: {
      appUrl: "https://app.kabrun.test",
      dataHashSecret: "test-hash-secret-with-at-least-32-chars!!",
      defaultSettlementDelayDays: 30,
      minimumPayout: { BRL: 1000n },
      payoutFee: { BRL: options.payoutFee ?? 367n },
    },
  });

  async function deliver(event: MockEvent, eventId?: string) {
    const { rawBody, headers } = mock.buildWebhook(event, eventId);
    const result = await services.webhookIngestion.ingest("MOCK", rawBody, headers);
    // The job itself relays the outbox, so events are settled when drain resolves.
    await queue.drain();
    return { duplicate: result.duplicate };
  }

  return { prisma, services, mock, email, storage, queue, clock, deliver };
}

/** Creates user + organization (via real onboarding) + product + offer + checkout. */
export async function createSeller(app: TestApp, options: { amount?: bigint; currency?: string; slug?: string } = {}) {
  const slug = options.slug ?? `org-${randomUUID().slice(0, 8)}`;
  const user = await app.prisma.user.create({
    data: { keycloakUserId: `kc-${randomUUID()}`, email: `${slug}@example.com`, name: "Seller" },
  });
  const organization = await app.services.organizations.onboard(user, {
    name: `Org ${slug}`,
    slug,
    country: "BR",
    businessType: "INDIVIDUAL",
    currency: options.currency ?? "BRL",
    taxIdType: "CPF",
    taxId: VALID_CPF,
    supportEmail: `${slug}@example.com`,
  });
  // Produtora brasileira recebe por Pix, e sem chave cadastrada o saque não sai: a chave é o
  // CPF da própria conta, que é o que a verificação de titularidade exige.
  await app.services.payoutDestinations.savePix({
    organizationId: organization.id,
    country: "BR",
    currency: options.currency ?? "BRL",
    rawKey: VALID_CPF,
  });
  const product = await app.services.products.create(organization.id, user.id, {
    name: "Curso Teste",
    slug: `curso-${slug}`,
    type: "COURSE",
    status: "ACTIVE",
  });
  const amount = options.amount ?? 10_000n;
  const offer = await app.services.offers.create(organization.id, user.id, {
    productId: product.id,
    name: "Oferta",
    price: `${amount / 100n},${String(amount % 100n).padStart(2, "0")}`,
    currency: options.currency ?? "BRL",
    billingType: "ONE_TIME",
    active: true,
  });
  const checkout = await app.services.checkouts.create(organization.id, user.id, {
    offerId: offer.id,
    name: "Checkout",
    slug: `co-${slug}`,
    headline: "Compre agora",
    accentColor: "#5B3DF5",
    collectPhone: false,
    guaranteeDays: 7,
    enabledPaymentMethods: [],
    orderBumps: [],
  });
  return { user, organization, product, offer, checkout };
}

/** Buyer goes through the public checkout; returns the Kabrun payment (status PENDING). */
export async function startPurchase(
  app: TestApp,
  checkoutSlug: string,
  email = `buyer-${randomUUID().slice(0, 6)}@example.com`,
  options: { couponCode?: string; referralCode?: string; locale?: Locale; bumpOfferIds?: string[] } = {},
) {
  const result = await app.services.checkouts.start({
    slug: checkoutSlug,
    attemptId: randomUUID(),
    sessionId: `sess-${randomUUID()}`,
    name: "Comprador",
    email,
    couponCode: options.couponCode,
    referralCode: options.referralCode,
    locale: options.locale,
    bumpOfferIds: options.bumpOfferIds,
    tracking: { utm_source: "test" },
  });
  const payment = await app.prisma.payment.findUniqueOrThrow({ where: { id: result.paymentId } });
  return { result, payment };
}

export async function confirmPayment(
  app: TestApp,
  payment: { providerPaymentId: string | null; amount: bigint; currency: string },
  eventId?: string,
  /** O meio que o provedor informa. Sem isto o mock diz cartão, como a maioria das vendas. */
  paymentMethod?: PaymentMethodType,
) {
  return app.deliver(
    {
      type: "payment.succeeded",
      providerPaymentId: payment.providerPaymentId!,
      amount: payment.amount.toString(),
      currency: payment.currency,
      paymentMethod,
    },
    eventId,
  );
}

/** Runs one relay pass: publishes events still pending, and retries failed ones. */
export async function flushEvents(app: TestApp): Promise<number> {
  return app.services.outboxPublisher.publishPending();
}

/** Sum of each account (normal side) across ALL organizations, opcionalmente de uma moeda. */
export async function accountTotals(prisma: PrismaClient, organizationId?: string, currency?: string) {
  const rows = await prisma.ledgerEntry.groupBy({
    by: ["account", "direction"],
    where: { ...(organizationId ? { organizationId } : {}), ...(currency ? { currency } : {}) },
    _sum: { amount: true },
  });
  const net: Record<string, bigint> = {};
  for (const r of rows) {
    const v = r._sum.amount ?? 0n;
    net[r.account] = (net[r.account] ?? 0n) + (r.direction === "DEBIT" ? v : -v);
  }
  return net; // debit-positive
}

/**
 * Invariante da transferência entre contas: ela existe aos pares.
 *
 * O `post` garante que cada lançamento fecha em si, mas não que exista o outro lado — e é o
 * outro lado que torna a transferência verdadeira: o valor que sai da conta de quem vendeu
 * entra na de quem indicou, pela mesma comissão e pelo mesmo valor. Um lançamento órfão aqui
 * significaria dinheiro que saiu de uma conta e não chegou em nenhuma.
 */
export async function expectAffiliateTransfersPaired(prisma: PrismaClient) {
  const pairs = [
    ["affiliate.commission.transferred", "affiliate.commission.received"],
    ["affiliate.commission.returned", "affiliate.commission.reclaimed"],
  ] as const;
  const journals = await prisma.ledgerJournal.findMany({
    where: { type: { in: pairs.flat() } },
    include: { entries: true },
  });
  const total = (j: (typeof journals)[number]) => j.entries.reduce((sum, e) => (e.direction === "DEBIT" ? sum + e.amount : sum), 0n);

  for (const [sentType, receivedType] of pairs) {
    const sent = journals.filter((j) => j.type === sentType);
    const received = journals.filter((j) => j.type === receivedType);
    const matched = new Set<string>();
    for (const journal of sent) {
      const twin = received.find(
        (candidate) =>
          !matched.has(candidate.id) &&
          candidate.referenceId === journal.referenceId &&
          candidate.organizationId !== journal.organizationId &&
          total(candidate) === total(journal),
      );
      if (!twin) throw new Error(`${sentType} ${journal.referenceId} (${total(journal)}) has no matching ${receivedType}`);
      matched.add(twin.id);
    }
    if (matched.size !== received.length) throw new Error(`${receivedType}: ${received.length - matched.size} without a ${sentType}`);
  }
}

/** Double-entry invariant: total debits == total credits (money is never created or lost). */
export async function expectLedgerBalanced(prisma: PrismaClient) {
  const totals = await prisma.ledgerEntry.groupBy({ by: ["direction"], _sum: { amount: true } });
  const debit = totals.find((t) => t.direction === "DEBIT")?._sum.amount ?? 0n;
  const credit = totals.find((t) => t.direction === "CREDIT")?._sum.amount ?? 0n;
  if (debit !== credit) throw new Error(`Ledger unbalanced: debit=${debit} credit=${credit}`);
  const journals = await prisma.ledgerJournal.findMany({ include: { entries: true } });
  for (const j of journals) {
    const d = j.entries.filter((e) => e.direction === "DEBIT").reduce((a, e) => a + e.amount, 0n);
    const c = j.entries.filter((e) => e.direction === "CREDIT").reduce((a, e) => a + e.amount, 0n);
    if (d !== c) throw new Error(`Journal ${j.type} unbalanced`);
  }
}
