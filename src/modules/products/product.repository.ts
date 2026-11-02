import type { DbClient } from "@/lib/database/postgres/client";
import type { Product, ProductStatus, ProductType } from "@/generated/prisma/client";
import { classifyDelivery, type ProductDelivery } from "./product-delivery";

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
  /** Null when the product does not exist in this organization. */
  findDelivery(organizationId: string, id: string): Promise<ProductDelivery | null>;
  deliveryByProduct(organizationId: string): Promise<Map<string, ProductDelivery>>;
}

/** Just enough of the content tree to tell whether a purchase delivers anything. */
const DELIVERY_SELECT = {
  id: true,
  course: { select: { id: true, published: true, modules: { select: { _count: { select: { lessons: true } } } } } },
} as const;

type DeliveryRow = {
  id: string;
  course: { id: string; published: boolean; modules: { _count: { lessons: number } }[] } | null;
};

function toDelivery(row: DeliveryRow): ProductDelivery {
  return classifyDelivery(
    row.course && {
      id: row.course.id,
      published: row.course.published,
      lessons: row.course.modules.reduce((total, module) => total + module._count.lessons, 0),
    },
  );
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

  async findDelivery(organizationId: string, id: string) {
    const row = await this.db.product.findFirst({ where: { id, organizationId }, select: DELIVERY_SELECT });
    return row ? toDelivery(row) : null;
  }

  async deliveryByProduct(organizationId: string) {
    const rows = await this.db.product.findMany({ where: { organizationId }, select: DELIVERY_SELECT });
    return new Map(rows.map((row) => [row.id, toDelivery(row)]));
  }
}
