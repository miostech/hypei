import { ConflictError, NotFoundError } from "@/lib/errors";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { ProductInput } from "./product.schemas";

export class ProductService {
  constructor(private readonly uow: UnitOfWork) {}

  list(organizationId: string) {
    return this.uow.repos.products.list(organizationId);
  }

  async get(organizationId: string, id: string) {
    const product = await this.uow.repos.products.findById(organizationId, id);
    if (!product) throw new NotFoundError("Product", id);
    return product;
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
      thumbnailUrl: input.thumbnailUrl || null,
    };
  }
}
