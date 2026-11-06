import type { DbClient } from "@/lib/database/postgres/client";
import type { Checkout, CheckoutStatus, Offer, Organization, Product } from "@/generated/prisma/client";

export type CheckoutWithOffer = Checkout & { offer: Offer & { product: Product } };
export type PublicCheckoutRecord = Checkout & { offer: Offer & { product: Product }; organization: Organization };

export interface CheckoutRepository {
  list(organizationId: string): Promise<CheckoutWithOffer[]>;
  findById(organizationId: string, id: string): Promise<CheckoutWithOffer | null>;
  findPublicBySlug(slug: string): Promise<PublicCheckoutRecord | null>;
  slugExists(slug: string): Promise<boolean>;
  /**
   * O checkout ativo de um produto, para onde o link do afiliado leva.
   *
   * O afiliado divulga um produto, não uma página: é o produtor que decide por qual
   * checkout a venda entra, e pode trocar isso sem invalidar links já distribuídos.
   */
  findActiveSlugByProduct(productId: string): Promise<string | null>;
  create(input: { id: string; organizationId: string; offerId: string; slug: string; name: string }): Promise<Checkout>;
  setVersion(organizationId: string, id: string, version: number): Promise<void>;
  setStatus(organizationId: string, id: string, status: CheckoutStatus): Promise<void>;
}

export class PrismaCheckoutRepository implements CheckoutRepository {
  constructor(private readonly db: DbClient) {}

  list(organizationId: string) {
    return this.db.checkout.findMany({
      where: { organizationId },
      include: { offer: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  findById(organizationId: string, id: string) {
    return this.db.checkout.findFirst({
      where: { id, organizationId },
      include: { offer: { include: { product: true } } },
    });
  }

  findPublicBySlug(slug: string) {
    return this.db.checkout.findUnique({
      where: { slug },
      include: { offer: { include: { product: true } }, organization: true },
    });
  }

  async findActiveSlugByProduct(productId: string) {
    const checkout = await this.db.checkout.findFirst({
      where: { status: "ACTIVE", offer: { productId } },
      select: { slug: true },
      orderBy: { createdAt: "asc" },
    });
    return checkout?.slug ?? null;
  }

  async slugExists(slug: string) {
    return (await this.db.checkout.count({ where: { slug } })) > 0;
  }

  create(input: { id: string; organizationId: string; offerId: string; slug: string; name: string }) {
    return this.db.checkout.create({ data: input });
  }

  async setVersion(organizationId: string, id: string, version: number) {
    await this.db.checkout.updateMany({ where: { id, organizationId }, data: { currentVersion: version } });
  }

  async setStatus(organizationId: string, id: string, status: CheckoutStatus) {
    await this.db.checkout.updateMany({ where: { id, organizationId }, data: { status } });
  }
}
