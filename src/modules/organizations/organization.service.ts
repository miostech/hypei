import type { Organization, User } from "@/generated/prisma/client";
import { ConflictError, ValidationError } from "@/lib/errors";
import { createDomainEvent } from "@/lib/events/domain-event";
import { logger } from "@/lib/logger";
import { hashTaxId, maskTaxId, TAX_ID_TYPES_BY_COUNTRY, validateTaxId } from "@/modules/compliance/tax-identity";
import type { MerchantAccountService } from "@/modules/merchant-accounts/merchant-account.service";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { OnboardingInput } from "./organization.schemas";

/**
 * Producer onboarding. Creates the tenant (Organization + OWNER membership + masked
 * tax identity + verification record) atomically, then provisions the merchant account
 * at the payment provider (KYC/KYB happens in the provider's hosted onboarding).
 */
export class OrganizationService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly merchantAccounts: MerchantAccountService,
    private readonly dataHashSecret: string,
  ) {}

  async onboard(user: Pick<User, "id" | "email">, input: OnboardingInput): Promise<Organization> {
    const allowed = TAX_ID_TYPES_BY_COUNTRY[input.country]?.[input.businessType] ?? [];
    if (!allowed.includes(input.taxIdType)) {
      throw new ValidationError(`Documento ${input.taxIdType} não é aceito para ${input.country}/${input.businessType}`);
    }
    if (!validateTaxId(input.taxIdType, input.country, input.taxId)) {
      throw new ValidationError("Documento fiscal inválido", { field: "taxId" });
    }

    const organization = await this.uow.transaction(async (repos) => {
      if (await repos.organizations.slugExists(input.slug)) throw new ConflictError("Este endereço já está em uso", { field: "slug" });
      const org = await repos.organizations.create({
        name: input.name,
        slug: input.slug,
        country: input.country,
        defaultCurrency: input.currency,
        businessType: input.businessType,
        legalName: input.legalName || null,
        website: input.website || null,
        supportEmail: input.supportEmail,
      });
      await repos.organizations.addMember(org.id, user.id, "OWNER");
      await repos.organizations.addTaxIdentity({
        organizationId: org.id,
        country: input.country,
        type: input.taxIdType,
        maskedValue: maskTaxId(input.taxId),
        valueHash: hashTaxId(input.taxIdType, input.taxId, this.dataHashSecret),
      });
      await repos.organizations.createVerification({
        organizationId: org.id,
        type: input.businessType,
        status: "PENDING",
        provider: this.merchantProviderType(),
        submittedAt: new Date(),
      });
      await repos.organizations.activate(org.id);
      await repos.audit.record({ organizationId: org.id, userId: user.id, action: "organization.created", entity: "Organization", entityId: org.id });
      await repos.outbox.add(createDomainEvent("organization.created", org.id, org.id, { name: org.name, country: org.country }));
      return { ...org, status: "ACTIVE" as const };
    });

    try {
      await this.merchantAccounts.ensureForOrganization(organization, input.supportEmail || user.email);
    } catch (err) {
      // The org exists; the merchant account can be created later from /integrations.
      logger.error({ err, organizationId: organization.id }, "merchant account provisioning failed");
    }
    return organization;
  }

  private merchantProviderType() {
    return this.merchantAccounts.providerType;
  }

  listForUser(userId: string) {
    return this.uow.repos.organizations.listMemberships(userId);
  }
}
