import { randomUUID } from "node:crypto";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { assertUploadableImage } from "@/lib/images";
import { buildAssetKey, signImage, type StorageProvider } from "@/lib/providers/storage";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { ProductInput } from "./product.schemas";

export class ProductService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly storage: StorageProvider,
  ) {}

  /**
   * Autoriza o envio da capa direto para o storage, como o banner do checkout. O produto
   * precisa existir: a chave do objeto é derivada dele.
   */
  async createThumbnailUpload(
    organizationId: string,
    productId: string,
    input: { filename: string; contentType: string; sizeBytes: number },
  ) {
    const product = await this.uow.repos.products.findById(organizationId, productId);
    if (!product) throw new NotFoundError("Product", productId);
    assertUploadableImage(input);

    const key = buildAssetKey({ organizationId, scope: "products", scopeId: productId, filename: input.filename, id: randomUUID() });
    return this.storage.createUpload({ key, contentType: input.contentType });
  }

  /** URL curta para mostrar a capa. Null quando não há capa ou a assinatura falhou. */
  thumbnailUrl(key: string | null): Promise<string | null> {
    return signImage(this.storage, key);
  }

  list(organizationId: string) {
    return this.uow.repos.products.list(organizationId);
  }

  async get(organizationId: string, id: string) {
    const product = await this.uow.repos.products.findById(organizationId, id);
    if (!product) throw new NotFoundError("Product", id);
    return product;
  }

  /** Whether paying for this product actually delivers something to the buyer. */
  async delivery(organizationId: string, id: string) {
    const delivery = await this.uow.repos.products.findDelivery(organizationId, id);
    if (!delivery) throw new NotFoundError("Product", id);
    return delivery;
  }

  deliveryByProduct(organizationId: string) {
    return this.uow.repos.products.deliveryByProduct(organizationId);
  }

  async create(organizationId: string, userId: string, input: ProductInput) {
    return this.uow.transaction(async (repos) => {
      if (await repos.products.slugTaken(organizationId, input.slug)) throw new ConflictError("Já existe um produto com este slug", { field: "slug" });
      const product = await repos.products.create(organizationId, this.toRecord(input));
      await repos.audit.record({ organizationId, userId, action: "product.created", entity: "Product", entityId: product.id });
      return product;
    });
  }

  async update(organizationId: string, userId: string, id: string, input: ProductInput) {
    return this.uow.transaction(async (repos) => {
      if (await repos.products.slugTaken(organizationId, input.slug, id)) throw new ConflictError("Já existe um produto com este slug", { field: "slug" });
      const product = await repos.products.update(organizationId, id, this.toRecord(input));
      if (!product) throw new NotFoundError("Product", id);
      await repos.audit.record({ organizationId, userId, action: "product.updated", entity: "Product", entityId: id });
      return product;
    });
  }

  /** Products are archived, never hard-deleted (orders reference them). */
  async archive(organizationId: string, userId: string, id: string) {
    return this.uow.transaction(async (repos) => {
      const product = await repos.products.update(organizationId, id, { status: "ARCHIVED" });
      if (!product) throw new NotFoundError("Product", id);
      await repos.audit.record({ organizationId, userId, action: "product.archived", entity: "Product", entityId: id });
      return product;
    });
  }

  private toRecord(input: ProductInput) {
    return {
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      type: input.type,
      status: input.status,
      thumbnailKey: input.thumbnailKey || null,
    };
  }
}
