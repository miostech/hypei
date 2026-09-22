import type { DbClient } from "@/lib/database/postgres/client";
import type { Product, ProductStatus, ProductType } from "@/generated/prisma/client";

export interface ProductWriteRecord {
  name: string;
  slug: string;
  description?: string | null;
  type: ProductType;
  status: ProductStatus;
  thumbnailUrl?: string | null;
}

export type ProductWithOfferCount = Product & { _count: { offers: number } };

/** Every method is scoped by organizationId — tenant isolation is enforced at the query level. */
export interface ProductRepository {
  list(organizationId: string): Promise<ProductWithOfferCount[]>;
  findById(organizationId: string, id: string): Promise<Product | null>;
  slugTaken(organizationId: string, slug: string, exceptId?: string): Promise<boolean>;
  create(organizationId: string, record: ProductWriteRecord): Promise<Product>;
  update(organizationId: string, id: string, record: Partial<ProductWriteRecord>): Promise<Product | null>;
  countByStatus(organizationId: string): Promise<Record<string, number>>;
}

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly db: DbClient) {}

  list(organizationId: string) {
    return this.db.product.findMany({
      where: { organizationId },
      include: { _count: { select: { offers: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(organizationId: string, id: string) {
    return this.db.product.findFirst({ where: { id, organizationId } });
  }

  async slugTaken(organizationId: string, slug: string, exceptId?: string) {
    const count = await this.db.product.count({
      where: { organizationId, slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    });
    return count > 0;
  }

  create(organizationId: string, record: ProductWriteRecord) {
    return this.db.product.create({ data: { ...record, organizationId } });
  }

  async update(organizationId: string, id: string, record: Partial<ProductWriteRecord>) {
    const result = await this.db.product.updateMany({ where: { id, organizationId }, data: record });
    if (result.count === 0) return null;
    return this.findById(organizationId, id);
  }

  async countByStatus(organizationId: string) {
    const rows = await this.db.product.groupBy({ by: ["status"], where: { organizationId }, _count: true });
    return Object.fromEntries(rows.map((r) => [r.status, r._count]));
  }
}
