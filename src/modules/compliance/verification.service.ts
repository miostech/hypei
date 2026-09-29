import type { BusinessType, MerchantAccount, PaymentProviderType, VerificationStatus } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";
import type { MerchantAccountService } from "@/modules/merchant-accounts/merchant-account.service";
import type { UnitOfWork } from "@/server/unit-of-work";
import { describeRequirements, type Requirement } from "./verification.requirements";

export interface VerificationOverview {
  status: VerificationStatus;
  provider: PaymentProviderType;
  businessType: BusinessType;
  country: string;
  legalName: string | null;
  /** Whether the organization can take money in and send money out right now. */
  canSell: boolean;
  canWithdraw: boolean;
  detailsSubmitted: boolean;
  hasAccount: boolean;
  requirements: Requirement[];
  taxIdentities: { type: string; maskedValue: string; country: string }[];
  submittedAt: Date | null;
  verifiedAt: Date | null;
}

/**
 * Identity verification (KYC for people, KYB for companies).
 *
 * The documents themselves never touch Ripay: they go to the payment provider's
 * hosted flow, which is also who decides. This service keeps our side of the
 * story — what the provider is waiting for, what it unlocks, and since when.
 */
export class VerificationService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly merchantAccounts: MerchantAccountService,
  ) {}

  async overview(organizationId: string): Promise<VerificationOverview> {
    const organization = await this.uow.repos.organizations.findById(organizationId);
    if (!organization) throw new NotFoundError("Organization", organizationId);

    const [account, verification, taxIdentities] = await Promise.all([
      this.merchantAccounts.getForOrganization(organizationId),
      this.uow.repos.organizations.findVerification(organizationId),
      this.uow.repos.organizations.taxIdentities(organizationId),
    ]);

    return {
      status: verification?.status ?? "NOT_STARTED",
      provider: this.merchantAccounts.providerType,
      businessType: organization.businessType,
      country: organization.country,
      legalName: organization.legalName,
      canSell: account?.chargesEnabled ?? false,
      canWithdraw: account?.payoutsEnabled ?? false,
      detailsSubmitted: account?.detailsSubmitted ?? false,
      hasAccount: account !== null,
      requirements: describeRequirements(account?.requirementsDue ?? []),
      taxIdentities,
      submittedAt: verification?.submittedAt ?? null,
      verifiedAt: verification?.verifiedAt ?? null,
    };
  }

  /**
   * Opens (or reopens) the provider's hosted verification. Marks our record as
   * submitted so the producer sees the flow started even before the provider
   * answers, which can take days.
   */
  async startVerification(organizationId: string, userId: string, appUrl: string): Promise<{ url: string }> {
    const organization = await this.uow.repos.organizations.findById(organizationId);
    if (!organization) throw new NotFoundError("Organization", organizationId);

    const account = await this.merchantAccounts.ensureForOrganization(organization);
    const link = await this.merchantAccounts.createOnboardingLink(organizationId, appUrl);

    await this.uow.transaction(async (repos) => {
      await repos.organizations.markVerificationSubmitted(organizationId, account.provider, account.providerAccountId);
      await repos.audit.record({
        organizationId,
        userId,
        action: "verification.started",
        entity: "Organization",
        entityId: organizationId,
        metadata: { provider: account.provider },
      });
    });

    return link;
  }

  /** Pulls the provider's current decision instead of waiting for the webhook. */
  async refresh(organizationId: string): Promise<MerchantAccount> {
    return this.merchantAccounts.sync(organizationId);
  }
}
