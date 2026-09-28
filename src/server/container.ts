import "server-only";
import type { PaymentProviderType } from "@/generated/prisma/enums";
import { systemClock } from "@/lib/clock";
import { getMongoDb } from "@/lib/database/mongo/client";
import { ensureMongoIndexes } from "@/lib/database/mongo/collections";
import { getPrisma } from "@/lib/database/postgres/client";
import { getEnv } from "@/lib/env";
import { InProcessEventBus } from "@/lib/events/event-bus";
import { logger } from "@/lib/logger";
import { MockPaymentProvider } from "@/lib/providers/payment/mock/mock-payment-provider";
import { StripePaymentProvider } from "@/lib/providers/payment/stripe/stripe-payment-provider";
import type { PaymentProvider } from "@/lib/providers/payment/types";
import { InMemoryJobQueue, UnsupportedQueueDriver } from "@/lib/providers/queue/job-queue";
import { getStripeClient } from "@/lib/stripe/stripe-client";
import { formatMoney, money } from "@/lib/money";
import { MongoAnalyticsEventRepository } from "@/modules/analytics/analytics-event.repository";
import { MongoCheckoutConfigRepository } from "@/modules/checkout/checkout-config.repository";
import { MongoProviderSnapshotRepository } from "@/modules/integrations/provider-snapshot.repository";
import { MongoRiskEventRepository } from "@/modules/risk/risk-event.repository";
import { MongoWebhookPayloadRepository } from "@/modules/webhooks/webhook-payload.repository";
import { buildServices, type Services } from "./services";

const globalForContainer = globalThis as unknown as { __ripayServices?: Services };

/** Mongo indexes are created lazily once per process (idempotent). */
let indexesReady: Promise<void> | undefined;
async function mongoDb() {
  const db = await getMongoDb();
  indexesReady ??= ensureMongoIndexes(db).catch((err) => {
    indexesReady = undefined;
    logger.warn({ err }, "failed to ensure mongo indexes");
  });
  await indexesReady;
  return db;
}

function createContainer(): Services {
  const env = getEnv();
  const queue = env.QUEUE_DRIVER === "memory" ? new InMemoryJobQueue() : new UnsupportedQueueDriver(env.QUEUE_DRIVER);
  const eventBus = new InProcessEventBus();

  const holder: { services?: Services } = {};
  const mock = new MockPaymentProvider({
    webhookSecret: env.MOCK_WEBHOOK_SECRET,
    processorFeeBps: env.MOCK_PROCESSOR_FEE_BPS,
    autoActivateMerchants: true,
    // Mock events go through the same verified webhook pipeline as real providers.
    deliver: async (rawBody, headers) => {
      await holder.services?.webhookIngestion.ingest("MOCK", rawBody, headers);
    },
  });

  const webhookProviders: Partial<Record<PaymentProviderType, PaymentProvider>> = { MOCK: mock };
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
    webhookProviders.STRIPE = new StripePaymentProvider(getStripeClient(), env.STRIPE_WEBHOOK_SECRET);
  }
  const paymentProvider = env.PAYMENT_PROVIDER === "stripe" ? webhookProviders.STRIPE! : mock;

  const services = buildServices({
    prisma: getPrisma(),
    paymentProvider,
    webhookProviders,
    mongo: {
      checkoutConfigs: new MongoCheckoutConfigRepository(mongoDb),
      analyticsEvents: new MongoAnalyticsEventRepository(mongoDb),
      webhookPayloads: new MongoWebhookPayloadRepository(mongoDb),
      providerSnapshots: new MongoProviderSnapshotRepository(mongoDb),
      riskEvents: new MongoRiskEventRepository(mongoDb),
    },
    queue,
    eventBus,
    clock: systemClock,
    config: {
      dataHashSecret: env.DATA_HASH_SECRET,
      // Fallback only when no SettlementPolicy matches (policies are data, see prisma/seed.ts).
      defaultSettlementDelayDays: 30,
      minimumPayout: { BRL: 1000n, EUR: 500n, USD: 500n },
    },
  });

  // Domain event subscribers (in-process today; Redis/BullMQ-backed later).
  eventBus.subscribe("payment.paid", async (event) => {
    const amount = BigInt(String(event.payload.amount));
    logger.info({ paymentId: event.aggregateId, amount: formatMoney(money(amount, String(event.payload.currency))) }, "payment.paid");
  });
  eventBus.subscribe("*", (event) => logger.debug({ type: event.type, aggregateId: event.aggregateId }, "domain event"));

  holder.services = services;
  logger.info({ paymentProvider: paymentProvider.type, queue: env.QUEUE_DRIVER }, "ripay container initialized");
  return services;
}

export function getServices(): Services {
  globalForContainer.__ripayServices ??= createContainer();
  return globalForContainer.__ripayServices;
}
