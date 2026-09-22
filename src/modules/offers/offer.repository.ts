import type { DbClient } from "@/lib/database/postgres/client";
import type { BillingInterval, BillingType, Offer, Product } from "@/generated/prisma/client";

export interface OfferWriteRecord {
  productId: string;
  name: string;
  amount: bigint;
  currency: string;
  billingType: BillingType;
  installments?: number | null;
  billingInterval?: BillingInterval | null;
  trialDays?: number | null;
  active: boolean;
}

export type OfferWithProduct = Offer & { product: Product };

export interface OfferRepository {
  list(organizationId: string): Promise<OfferWithProduct[]>;
  findById(organizationId: string, id: string): Promise<OfferWithProduct | null>;
  create(organizationId: string, record: OfferWriteRecord): Promise<Offer>;
  update(organizationId: string, id: string, record: Partial<OfferWriteRecord>): Promise<Offer | null>;
}

export class PrismaOfferRepository implements OfferRepository {
  constructor(private readonly db: DbClient) {}

  list(organizationId: string) {
    return this.db.offer.findMany({
      where: { organizationId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(organizationId: string, id: string) {
    return this.db.offer.findFirst({ where: { id, organizationId }, include: { product: true } });
  }

  create(organizationId: string, record: OfferWriteRecord) {
    return this.db.offer.create({ data: { ...record, organizationId } });
  }

  async update(organizationId: string, id: string, record: Partial<OfferWriteRecord>) {
    const result = await this.db.offer.updateMany({ where: { id, organizationId }, data: record });
    if (result.count === 0) return null;
    return this.db.offer.findFirst({ where: { id, organizationId } });
  }
}
