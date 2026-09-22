import type { DbClient } from "@/lib/database/postgres/client";
import type {
  BusinessType,
  Organization,
  OrganizationMember,
  OrganizationRole,
  TaxIdType,
  VerificationStatus,
  PaymentProviderType,
} from "@/generated/prisma/client";

export interface CreateOrganizationRecord {
  name: string;
  slug: string;
  country: string;
  defaultCurrency: string;
  businessType: BusinessType;
  legalName?: string | null;
  website?: string | null;
  supportEmail?: string | null;
}

export type MembershipWithOrganization = OrganizationMember & { organization: Organization };

export interface OrganizationRepository {
  create(record: CreateOrganizationRecord): Promise<Organization>;
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  slugExists(slug: string): Promise<boolean>;
  activate(id: string): Promise<void>;
  addMember(organizationId: string, userId: string, role: OrganizationRole): Promise<OrganizationMember>;
  findMembership(organizationId: string, userId: string): Promise<MembershipWithOrganization | null>;
  listMemberships(userId: string): Promise<MembershipWithOrganization[]>;
  addTaxIdentity(input: { organizationId: string; country: string; type: TaxIdType; maskedValue: string; valueHash: string }): Promise<void>;
  createVerification(input: {
    organizationId: string;
    type: BusinessType;
    status: VerificationStatus;
    provider: PaymentProviderType;
    submittedAt?: Date | null;
  }): Promise<void>;
  latestVerification(organizationId: string): Promise<{ status: VerificationStatus; type: BusinessType; provider: PaymentProviderType } | null>;
  updateVerificationStatus(organizationId: string, status: VerificationStatus, requirements: unknown): Promise<void>;
  taxIdentities(organizationId: string): Promise<{ type: TaxIdType; maskedValue: string; country: string }[]>;
}

export class PrismaOrganizationRepository implements OrganizationRepository {
  constructor(private readonly db: DbClient) {}

  create(record: CreateOrganizationRecord) {
    return this.db.organization.create({ data: record });
  }

  findById(id: string) {
    return this.db.organization.findUnique({ where: { id } });
  }

  findBySlug(slug: string) {
    return this.db.organization.findUnique({ where: { slug } });
  }

  async slugExists(slug: string) {
    return (await this.db.organization.count({ where: { slug } })) > 0;
  }

  async activate(id: string) {
    await this.db.organization.update({ where: { id }, data: { status: "ACTIVE" } });
  }

  addMember(organizationId: string, userId: string, role: OrganizationRole) {
    return this.db.organizationMember.create({ data: { organizationId, userId, role } });
  }

  findMembership(organizationId: string, userId: string) {
    return this.db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      include: { organization: true },
    });
  }

  listMemberships(userId: string) {
    return this.db.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async addTaxIdentity(input: { organizationId: string; country: string; type: TaxIdType; maskedValue: string; valueHash: string }) {
    await this.db.taxIdentity.create({ data: input });
  }

  async createVerification(input: {
    organizationId: string;
    type: BusinessType;
    status: VerificationStatus;
    provider: PaymentProviderType;
    submittedAt?: Date | null;
  }) {
    await this.db.organizationVerification.create({ data: input });
  }

  latestVerification(organizationId: string) {
    return this.db.organizationVerification.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: { status: true, type: true, provider: true },
    });
  }

  async updateVerificationStatus(organizationId: string, status: VerificationStatus, requirements: unknown) {
    await this.db.organizationVerification.updateMany({
      where: { organizationId },
      data: {
        status,
        requirements: requirements as object,
        ...(status === "VERIFIED" ? { verifiedAt: new Date() } : {}),
      },
    });
  }

  taxIdentities(organizationId: string) {
    return this.db.taxIdentity.findMany({
      where: { organizationId },
      select: { type: true, maskedValue: true, country: true },
    });
  }
}
