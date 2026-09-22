import type { MerchantAccount, Organization } from "@/generated/prisma/client";
import type { MerchantAccountStatus, VerificationStatus } from "@/generated/prisma/enums";
import { NotFoundError } from "@/lib/errors";
import { createDomainEvent } from "@/lib/events/domain-event";
import { logger } from "@/lib/logger";
import { assertSupportedCurrency } from "@/lib/money";
import { deriveMerchantAccountStatus } from "@/lib/providers/payment/merchant-status";
import type { MerchantAccountSnapshot, PaymentProvider } from "@/lib/providers/payment/types";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { ProviderSnapshotRepository } from "@/modules/integrations/provider-snapshot.repository";

const VERIFICATION_BY_STATUS: Record<MerchantAccountStatus, VerificationStatus> = {
  PENDING: "PENDING",
  REQUIRES_ACTION: "REQUIRES_ACTION",
  UNDER_REVIEW: "PENDING",
  ACTIVE: "VERIFIED",
  RESTRICTED: "REQUIRES_ACTION",
  DISABLED: "REJECTED",
};

/**
 * Generic connected-account lifecycle (Stripe Connect today). KYC/KYB and bank details are
 * collected by the provider's hosted onboarding — Hypei only stores status for control/display.
 */
export class MerchantAccountService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly provider: PaymentProvider,
    private readonly snapshots?: ProviderSnapshotRepository,
  ) {}

  get providerType() {
    return this.provider.type;
  }

  async ensureForOrganization(organization: Organization, email?: string): Promise<MerchantAccount> {
    const existing = await this.uow.repos.merchantAccounts.findByOrganization(organization.id, this.provider.type);
    if (existing) return existing;
    const snapshot = await this.provider.createMerchantAccount({
      organizationId: organization.id,
      country: organization.country,
      defaultCurrency: assertSupportedCurrency(organization.defaultCurrency),
      businessType: organization.businessType,
      email,
      idempotencyKey: `merchant:${organization.id}`,
    });
    return this.persist(organization.id, snapshot);
  }

  async createOnboardingLink(organizationId: string, appUrl: string) {
    const account = await this.uow.repos.merchantAccounts.findByOrganization(organizationId, this.provider.type);
    if (!account) throw new NotFoundError("MerchantAccount");
    return this.provider.createMerchantOnboardingLink({
      providerAccountId: account.providerAccountId,
      refreshUrl: `${appUrl}/integrations?onboarding=refresh`,
      returnUrl: `${appUrl}/integrations?onboarding=return`,
      mode: account.detailsSubmitted ? "update" : "onboarding",
    });
  }

  /** Webhook (`account.updated`) or reconciliation pull. */
  async applySnapshot(snapshot: MerchantAccountSnapshot): Promise<"applied" | "ignored"> {
    const account = await this.uow.repos.merchantAccounts.findByProviderAccountId(this.provider.type, snapshot.providerAccountId);
    if (!account) {
      logger.warn({ providerAccountId: snapshot.providerAccountId }, "snapshot for unknown merchant account");
      return "ignored";
    }
    await this.persist(account.organizationId, snapshot);
    return "applied";
  }

  async sync(organizationId: string) {
    const account = await this.uow.repos.merchantAccounts.findByOrganization(organizationId, this.provider.type);
    if (!account) throw new NotFoundError("MerchantAccount");
    return this.persist(organizationId, await this.provider.getMerchantAccount(account.providerAccountId));
  }

  getForOrganization(organizationId: string) {
    return this.uow.repos.merchantAccounts.findByOrganization(organizationId, this.provider.type);
  }

  private async persist(organizationId: string, snapshot: MerchantAccountSnapshot) {
    const status = deriveMerchantAccountStatus(snapshot);
    const account = await this.uow.transaction(async (repos) => {
      const saved = await repos.merchantAccounts.upsertFromSnapshot({ organizationId, provider: this.provider.type, snapshot, status });
      await repos.organizations.updateVerificationStatus(organizationId, VERIFICATION_BY_STATUS[status], snapshot.requirements);
      await repos.outbox.add(createDomainEvent("merchant_account.updated", saved.id, organizationId, { status }));
      return saved;
    });
    await this.snapshots
      ?.record({ provider: this.provider.type, objectType: "merchant_account", objectId: snapshot.providerAccountId, organizationId, data: snapshot })
      .catch((err) => logger.warn({ err }, "failed to archive merchant snapshot"));
    return account;
  }
}
