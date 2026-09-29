import type { DbClient } from "@/lib/database/postgres/client";
import type { AwardStatus, AwardTier, OrganizationAward, Prisma } from "@/generated/prisma/client";

export type AwardWithOrganization = OrganizationAward & { organization: { id: string; name: string; slug: string } };

export interface AwardRepository {
  /**
   * Lifetime net revenue per currency: the producer's share of every captured
   * payment, reduced in proportion to what was refunded, with chargebacks
   * counting as zero.
   */
  netRevenue(organizationId: string): Promise<{ currency: string; net: bigint }[]>;
  listForOrganization(organizationId: string): Promise<OrganizationAward[]>;
  /** Grants a tier once; a second attempt for the same tier is a no-op. */
  grant(input: Prisma.OrganizationAwardUncheckedCreateInput): Promise<boolean>;
  listAll(status: AwardStatus | null, limit: number): Promise<AwardWithOrganization[]>;
  registerShipping(id: string, trackingCode: string | null): Promise<OrganizationAward>;
  findById(id: string): Promise<OrganizationAward | null>;
}

export class PrismaAwardRepository implements AwardRepository {
  constructor(private readonly db: DbClient) {}

  netRevenue(organizationId: string) {
    return this.db.$queryRaw<{ currency: string; net: bigint }[]>`
      SELECT currency,
             COALESCE(SUM(
               CASE
                 WHEN status = 'CHARGEBACK' THEN 0
                 ELSE ("producerNetAmount" * (amount - "refundedAmount")) / amount
               END
             ), 0)::bigint AS net
      FROM "Payment"
      WHERE "organizationId" = ${organizationId}
        AND "producerNetAmount" IS NOT NULL
        AND amount > 0
        AND status IN ('PAID', 'PARTIALLY_REFUNDED', 'CHARGEBACK')
      GROUP BY currency`;
  }

  listForOrganization(organizationId: string) {
    return this.db.organizationAward.findMany({ where: { organizationId }, orderBy: { threshold: "asc" } });
  }

  async grant(input: Prisma.OrganizationAwardUncheckedCreateInput) {
    const result = await this.db.organizationAward.createMany({ data: input, skipDuplicates: true });
    return result.count > 0;
  }

  listAll(status: AwardStatus | null, limit: number) {
    return this.db.organizationAward.findMany({
      where: status ? { status } : undefined,
      include: { organization: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ status: "asc" }, { achievedAt: "desc" }],
      take: limit,
    });
  }

  registerShipping(id: string, trackingCode: string | null) {
    return this.db.organizationAward.update({
      where: { id },
      data: { status: "SHIPPED", trackingCode, shippedAt: new Date() },
    });
  }

  findById(id: string) {
    return this.db.organizationAward.findUnique({ where: { id } });
  }
}

export type { AwardStatus, AwardTier };
