import type { PrismaClient } from "@/generated/prisma/client";
import type { PaymentProviderType } from "@/generated/prisma/enums";
import type { Clock } from "@/lib/clock";
import type { EventBus } from "@/lib/events/event-bus";
import { OutboxPublisher } from "@/lib/events/outbox-publisher";
import { IdempotencyService } from "@/lib/idempotency/idempotency.service";
import { logger } from "@/lib/logger";
import type { CurrencyCode } from "@/lib/money";
import type { PaymentProvider } from "@/lib/providers/payment/types";
import type { JobQueue } from "@/lib/providers/queue/job-queue";
import type { AnalyticsEventRepository } from "@/modules/analytics/analytics-event.repository";
import { TrackingService } from "@/modules/analytics/tracking.service";
import { BalanceService } from "@/modules/balances/balance.service";
import { FinanceOverviewService } from "@/modules/balances/finance-overview.service";
import type { CheckoutConfigRepository } from "@/modules/checkout/checkout-config.repository";
import { CheckoutService } from "@/modules/checkout/checkout.service";
import { DisputeService } from "@/modules/disputes/dispute.service";
import type { ProviderSnapshotRepository } from "@/modules/integrations/provider-snapshot.repository";
import { LedgerService } from "@/modules/ledger/ledger.service";
import { MerchantAccountService } from "@/modules/merchant-accounts/merchant-account.service";
import { OfferService } from "@/modules/offers/offer.service";
import { OrganizationService } from "@/modules/organizations/organization.service";
import { PaymentService } from "@/modules/payments/payment.service";
import { PayoutService } from "@/modules/payouts/payout.service";
import { ProductService } from "@/modules/products/product.service";
import { RefundService } from "@/modules/refunds/refund.service";
import type { RiskEventRepository } from "@/modules/risk/risk-event.repository";
import { RiskService } from "@/modules/risk/risk.service";
import { SettlementService } from "@/modules/settlements/settlement.service";
import { SubscriptionService } from "@/modules/subscriptions/subscription.service";
import { WEBHOOK_JOB, WebhookIngestionService } from "@/modules/webhooks/webhook-ingestion.service";
import type { WebhookPayloadRepository } from "@/modules/webhooks/webhook-payload.repository";
import { WebhookProcessor } from "@/modules/webhooks/webhook-processor.service";
import { PrismaUnitOfWork } from "./unit-of-work";

export interface ServiceDependencies {
  prisma: PrismaClient;
  /** The active provider for new payments/payouts. */
  paymentProvider: PaymentProvider;
  /** Providers able to receive webhooks (active one + legacy ones still settling). */
  webhookProviders: Partial<Record<PaymentProviderType, PaymentProvider>>;
  mongo: {
    checkoutConfigs: CheckoutConfigRepository;
    analyticsEvents: AnalyticsEventRepository;
    webhookPayloads: WebhookPayloadRepository;
    providerSnapshots?: ProviderSnapshotRepository;
    riskEvents?: RiskEventRepository;
  };
  queue: JobQueue;
  eventBus: EventBus;
  clock: Clock;
  config: {
    dataHashSecret: string;
    defaultSettlementDelayDays: number;
    minimumPayout: Partial<Record<CurrencyCode, bigint>>;
  };
}

export type Services = ReturnType<typeof buildServices>;

/** Wires every domain service. Business services only ever see repositories and interfaces. */
export function buildServices(deps: ServiceDependencies) {
  const uow = new PrismaUnitOfWork(deps.prisma);
  const balances = new BalanceService();
  const ledger = new LedgerService(balances);
  const payments = new PaymentService(uow, deps.paymentProvider, ledger, deps.clock, {
    defaultSettlementDelayDays: deps.config.defaultSettlementDelayDays,
  });
  const refunds = new RefundService(uow, deps.paymentProvider, ledger);
  const disputes = new DisputeService(uow, ledger);
  const settlements = new SettlementService(uow, ledger, deps.clock);
  const risk = new RiskService(deps.mongo.riskEvents);
  const payouts = new PayoutService(uow, deps.paymentProvider, ledger, balances, risk, deps.clock, {
    minimumPayout: deps.config.minimumPayout,
  });
  const merchantAccounts = new MerchantAccountService(uow, deps.paymentProvider, deps.mongo.providerSnapshots);
  const subscriptions = new SubscriptionService(uow);
  const organizations = new OrganizationService(uow, merchantAccounts, deps.config.dataHashSecret);
  const products = new ProductService(uow);
  const offers = new OfferService(uow);
  const tracking = new TrackingService(deps.mongo.analyticsEvents);
  const idempotency = new IdempotencyService(uow.repos.idempotency);
  const checkouts = new CheckoutService(uow, deps.mongo.checkoutConfigs, payments, tracking, idempotency, deps.paymentProvider.type);
  const finance = new FinanceOverviewService(uow);
  const outboxPublisher = new OutboxPublisher(uow.repos.outbox, deps.eventBus);

  const webhookIngestion = new WebhookIngestionService(uow, deps.webhookProviders, deps.mongo.webhookPayloads, deps.queue);
  const webhookProcessor = new WebhookProcessor(
    uow,
    deps.webhookProviders,
    deps.mongo.webhookPayloads,
    { payments, refunds, disputes, payouts, merchantAccounts, subscriptions },
    deps.clock,
  );

  deps.queue.process<{ webhookEventId: string }>(WEBHOOK_JOB, async ({ webhookEventId }) => {
    await webhookProcessor.process(webhookEventId);
    void outboxPublisher.publishPending().catch((err) => logger.warn({ err }, "outbox relay failed"));
  });

  return {
    uow,
    ledger,
    balances,
    payments,
    refunds,
    disputes,
    settlements,
    payouts,
    merchantAccounts,
    subscriptions,
    organizations,
    products,
    offers,
    tracking,
    checkouts,
    finance,
    outboxPublisher,
    webhookIngestion,
    webhookProcessor,
    paymentProvider: deps.paymentProvider,
  };
}
