import type { DbClient } from "@/lib/database/postgres/client";
import type { Coupon, Prisma } from "@/generated/prisma/client";

export type CouponListItem = Coupon & { product: { id: string; name: string } | null };

export interface CouponRepository {
  create(input: Prisma.CouponUncheckedCreateInput): Promise<Coupon>;
  update(organizationId: string, id: string, data: Prisma.CouponUncheckedUpdateInput): Promise<Coupon>;
  remove(organizationId: string, id: string): Promise<void>;
  findById(organizationId: string, id: string): Promise<CouponListItem | null>;
  findByCode(organizationId: string, code: string): Promise<Coupon | null>;
  list(organizationId: string): Promise<CouponListItem[]>;
  /**
   * Increments the counter only while the limit allows it, in a single statement.
   * Returns false when the coupon ran out — two buyers racing for the last use
   * cannot both win.
   */
  claimRedemption(couponId: string): Promise<boolean>;
  releaseRedemption(couponId: string): Promise<void>;
  countCustomerRedemptions(couponId: string, customerId: string): Promise<number>;
  recordRedemption(input: { couponId: string; orderId: string; customerId: string; amount: bigint }): Promise<void>;
}

export class PrismaCouponRepository implements CouponRepository {
  constructor(private readonly db: DbClient) {}

  create(input: Prisma.CouponUncheckedCreateInput) {
    return this.db.coupon.create({ data: input });
  }

  async update(organizationId: string, id: string, data: Prisma.CouponUncheckedUpdateInput) {
    const result = await this.db.coupon.updateMany({ where: { id, organizationId }, data });
    if (result.count === 0) throw new Error(`Coupon ${id} not found in organization ${organizationId}`);
    return this.db.coupon.findUniqueOrThrow({ where: { id } });
  }

  async remove(organizationId: string, id: string) {
    await this.db.coupon.deleteMany({ where: { id, organizationId } });
  }

  findById(organizationId: string, id: string) {
    return this.db.coupon.findFirst({
      where: { id, organizationId },
      include: { product: { select: { id: true, name: true } } },
    });
  }

  findByCode(organizationId: string, code: string) {
    return this.db.coupon.findFirst({ where: { organizationId, code } });
  }

  list(organizationId: string) {
    return this.db.coupon.findMany({
      where: { organizationId },
      include: { product: { select: { id: true, name: true } } },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    });
  }

  async claimRedemption(couponId: string) {
    const claimed = await this.db.$executeRaw`
      UPDATE "Coupon"
      SET redemptions = redemptions + 1, "updatedAt" = now()
      WHERE id = ${couponId}
        AND active = true
        AND ("maxRedemptions" IS NULL OR redemptions < "maxRedemptions")`;
    return claimed > 0;
  }

  async releaseRedemption(couponId: string) {
    await this.db.$executeRaw`
      UPDATE "Coupon" SET redemptions = GREATEST(redemptions - 1, 0) WHERE id = ${couponId}`;
  }

  countCustomerRedemptions(couponId: string, customerId: string) {
    return this.db.couponRedemption.count({ where: { couponId, customerId } });
  }

  async recordRedemption(input: { couponId: string; orderId: string; customerId: string; amount: bigint }) {
    await this.db.couponRedemption.create({ data: input });
  }
}
