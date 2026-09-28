import type { DbClient } from "@/lib/database/postgres/client";
import { PrismaUserRepository, type UserRepository } from "@/modules/auth/user.repository";
import { PrismaOrganizationRepository, type OrganizationRepository } from "@/modules/organizations/organization.repository";
import { PrismaMerchantAccountRepository, type MerchantAccountRepository } from "@/modules/merchant-accounts/merchant-account.repository";
import { PrismaProductRepository, type ProductRepository } from "@/modules/products/product.repository";
import { PrismaOfferRepository, type OfferRepository } from "@/modules/offers/offer.repository";
import { PrismaCheckoutRepository, type CheckoutRepository } from "@/modules/checkout/checkout.repository";
import { PrismaCustomerRepository, type CustomerRepository } from "@/modules/customers/customer.repository";
import { PrismaOrderRepository, type OrderRepository } from "@/modules/orders/order.repository";
import { PrismaPaymentRepository, type PaymentRepository } from "@/modules/payments/payment.repository";
import { PrismaTransactionRepository, type TransactionRepository } from "@/modules/transactions/transaction.repository";
import { PrismaLedgerRepository, type LedgerRepository } from "@/modules/ledger/ledger.repository";
import { PrismaBalanceRepository, type BalanceRepository } from "@/modules/balances/balance.repository";
import { PrismaFinancialPolicyRepository, type FinancialPolicyRepository } from "@/modules/fees/financial-policy.repository";
import { PrismaPayoutRepository, type PayoutRepository } from "@/modules/payouts/payout.repository";
import { PrismaRefundRepository, type RefundRepository } from "@/modules/refunds/refund.repository";
import { PrismaDisputeRepository, type DisputeRepository } from "@/modules/disputes/dispute.repository";
import { PrismaWebhookEventRepository, type WebhookEventRepository } from "@/modules/webhooks/webhook-event.repository";
import { PrismaAuditRepository, type AuditRepository } from "@/modules/audit/audit.repository";
import { PrismaCourseRepository, type CourseRepository } from "@/modules/members/course.repository";
import { PrismaProgressRepository, type ProgressRepository } from "@/modules/members/progress.repository";
import { PrismaSubscriptionRepository, type SubscriptionRepository } from "@/modules/subscriptions/subscription.repository";
import { PrismaOutboxRepository, type OutboxRepository } from "@/lib/events/outbox.repository";
import { PrismaIdempotencyRepository, type IdempotencyRepository } from "@/lib/idempotency/idempotency.repository";

/** All PostgreSQL repositories bound to one client (root or transaction). */
export interface Repositories {
  users: UserRepository;
  organizations: OrganizationRepository;
  merchantAccounts: MerchantAccountRepository;
  products: ProductRepository;
  offers: OfferRepository;
  checkouts: CheckoutRepository;
  customers: CustomerRepository;
  orders: OrderRepository;
  payments: PaymentRepository;
  transactions: TransactionRepository;
  ledger: LedgerRepository;
  balances: BalanceRepository;
  policies: FinancialPolicyRepository;
  payouts: PayoutRepository;
  refunds: RefundRepository;
  disputes: DisputeRepository;
  webhookEvents: WebhookEventRepository;
  audit: AuditRepository;
  courses: CourseRepository;
  progress: ProgressRepository;
  subscriptions: SubscriptionRepository;
  outbox: OutboxRepository;
  idempotency: IdempotencyRepository;
}

export function createRepositories(db: DbClient): Repositories {
  return {
    users: new PrismaUserRepository(db),
    organizations: new PrismaOrganizationRepository(db),
    merchantAccounts: new PrismaMerchantAccountRepository(db),
    products: new PrismaProductRepository(db),
    offers: new PrismaOfferRepository(db),
    checkouts: new PrismaCheckoutRepository(db),
    customers: new PrismaCustomerRepository(db),
    orders: new PrismaOrderRepository(db),
    payments: new PrismaPaymentRepository(db),
    transactions: new PrismaTransactionRepository(db),
    ledger: new PrismaLedgerRepository(db),
    balances: new PrismaBalanceRepository(db),
    policies: new PrismaFinancialPolicyRepository(db),
    payouts: new PrismaPayoutRepository(db),
    refunds: new PrismaRefundRepository(db),
    disputes: new PrismaDisputeRepository(db),
    webhookEvents: new PrismaWebhookEventRepository(db),
    audit: new PrismaAuditRepository(db),
    courses: new PrismaCourseRepository(db),
    progress: new PrismaProgressRepository(db),
    subscriptions: new PrismaSubscriptionRepository(db),
    outbox: new PrismaOutboxRepository(db),
    idempotency: new PrismaIdempotencyRepository(db),
  };
}
