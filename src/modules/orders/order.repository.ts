import type { DbClient } from "@/lib/database/postgres/client";
import type { Customer, Dispute, Order, OrderItem, OrderStatus, Payment, Refund } from "@/generated/prisma/client";

export interface CreateOrderRecord {
  organizationId: string;
  customerId: string;
  checkoutId?: string | null;
  checkoutVersion?: number | null;
  currency: string;
  subtotalAmount: bigint;
  discountAmount: bigint;
  couponId?: string | null;
  couponCode?: string | null;
  affiliateId?: string | null;
  affiliateLinkId?: string | null;
  taxAmount: bigint;
  totalAmount: bigint;
  tracking?: Record<string, string | null> | null;
  items: { offerId: string; productName: string; offerName: string; quantity: number; unitAmount: bigint; totalAmount: bigint }[];
}

export type OrderListItem = Order & { customer: Customer; items: OrderItem[]; payments: Pick<Payment, "id" | "status" | "paymentMethod">[] };

/** Everything the sale page shows: who bought, what was charged, and what came after. */
export type OrderDetail = Order & {
  customer: Customer;
  items: OrderItem[];
  payments: (Payment & { refunds: Refund[]; disputes: Dispute[] })[];
};

export interface OrderRepository {
  create(record: CreateOrderRecord): Promise<Order>;
  findById(organizationId: string, id: string): Promise<Order | null>;
  findDetail(organizationId: string, id: string): Promise<OrderDetail | null>;
  setStatus(id: string, status: OrderStatus): Promise<void>;
  productIds(orderId: string): Promise<string[]>;
  list(organizationId: string, options: { limit: number }): Promise<OrderListItem[]>;
  /**
   * Finds a sale the way a producer looks for one: by who bought, what they
   * bought, the reference on the receipt, or the id the provider reported.
   * Always scoped to the organization — support searching must not cross tenants.
   */
  search(organizationId: string, query: string, limit: number): Promise<OrderListItem[]>;
  paidSummary(organizationId: string, sinceDays: number): Promise<{ currency: string; total: bigint; count: number }[]>;
  /** Paid orders inside an explicit window, used for "today" on the dashboard. */
  paidBetween(organizationId: string, from: Date, to: Date): Promise<{ currency: string; total: bigint; count: number }[]>;
  dailyPaidTotals(organizationId: string, sinceDays: number): Promise<{ day: Date; currency: string; total: bigint }[]>;
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly db: DbClient) {}

  create({ items, tracking, ...record }: CreateOrderRecord) {
    return this.db.order.create({
      data: {
        ...record,
        status: "PENDING_PAYMENT",
        tracking: tracking ?? undefined,
        items: { create: items.map((i) => ({ ...i, currency: record.currency })) },
      },
    });
  }

  findById(organizationId: string, id: string) {
    return this.db.order.findFirst({ where: { id, organizationId } });
  }

  findDetail(organizationId: string, id: string) {
    return this.db.order.findFirst({
      where: { id, organizationId },
      include: {
        customer: true,
        items: true,
        payments: {
          include: { refunds: { orderBy: { createdAt: "desc" } }, disputes: { orderBy: { createdAt: "desc" } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  async setStatus(id: string, status: OrderStatus) {
    await this.db.order.update({ where: { id }, data: { status } });
  }

  async productIds(orderId: string) {
    const items = await this.db.orderItem.findMany({ where: { orderId }, select: { offer: { select: { productId: true } } } });
    return [...new Set(items.map((i) => i.offer.productId))];
  }

  list(organizationId: string, options: { limit: number }) {
    return this.db.order.findMany({
      where: { organizationId },
      include: { customer: true, items: true, payments: { select: { id: true, status: true, paymentMethod: true } } },
      orderBy: { createdAt: "desc" },
      take: options.limit,
    });
  }

  search(organizationId: string, query: string, limit: number) {
    const term = query.trim();
    // The receipt shows the last 8 characters of the id, upper-cased.
    const reference = term.toLowerCase();

    return this.db.order.findMany({
      where: {
        organizationId,
        OR: [
          { id: term },
          { id: { endsWith: reference } },
          { customer: { name: { contains: term, mode: "insensitive" } } },
          { customer: { email: { contains: term, mode: "insensitive" } } },
          { items: { some: { productName: { contains: term, mode: "insensitive" } } } },
          { payments: { some: { providerPaymentId: term } } },
        ],
      },
      include: { customer: true, items: true, payments: { select: { id: true, status: true, paymentMethod: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async paidSummary(organizationId: string, sinceDays: number) {
    const since = new Date(Date.now() - sinceDays * 86_400_000);
    const rows = await this.db.order.groupBy({
      by: ["currency"],
      where: { organizationId, status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, createdAt: { gte: since } },
      _sum: { totalAmount: true },
      _count: true,
    });
    return rows.map((r) => ({ currency: r.currency, total: r._sum.totalAmount ?? 0n, count: r._count }));
  }

  async paidBetween(organizationId: string, from: Date, to: Date) {
    const rows = await this.db.order.groupBy({
      by: ["currency"],
      where: { organizationId, status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, createdAt: { gte: from, lt: to } },
      _sum: { totalAmount: true },
      _count: true,
    });
    return rows.map((r) => ({ currency: r.currency, total: r._sum.totalAmount ?? 0n, count: r._count }));
  }

  async dailyPaidTotals(organizationId: string, sinceDays: number) {
    const since = new Date(Date.now() - sinceDays * 86_400_000);
    return this.db.$queryRaw<{ day: Date; currency: string; total: bigint }[]>`
      SELECT date_trunc('day', "createdAt") AS day, currency, SUM("totalAmount")::bigint AS total
      FROM "Order"
      WHERE "organizationId" = ${organizationId}
        AND status IN ('PAID', 'PARTIALLY_REFUNDED')
        AND "createdAt" >= ${since}
      GROUP BY 1, 2
      ORDER BY 1 ASC`;
  }
}
