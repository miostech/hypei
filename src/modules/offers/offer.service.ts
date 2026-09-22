import { NotFoundError, ValidationError } from "@/lib/errors";
import { assertSupportedCurrency, parseDecimalToMinorUnits } from "@/lib/money";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { OfferInput } from "./offer.schemas";

/** Offers hold the OFFICIAL price of what is sold. Checkout presentation never overrides it. */
export class OfferService {
  constructor(private readonly uow: UnitOfWork) {}

  list(organizationId: string) {
    return this.uow.repos.offers.list(organizationId);
  }

  async get(organizationId: string, id: string) {
    const offer = await this.uow.repos.offers.findById(organizationId, id);
    if (!offer) throw new NotFoundError("Offer", id);
    return offer;
  }

  async create(organizationId: string, userId: string, input: OfferInput) {
    return this.uow.transaction(async (repos) => {
      // Tenant isolation: the product must belong to the same organization.
      const product = await repos.products.findById(organizationId, input.productId);
      if (!product) throw new NotFoundError("Product", input.productId);
      const offer = await repos.offers.create(organizationId, this.toRecord(input));
      await repos.audit.record({ organizationId, userId, action: "offer.created", entity: "Offer", entityId: offer.id, metadata: { amount: offer.amount, currency: offer.currency } });
      return offer;
    });
  }

  async update(organizationId: string, userId: string, id: string, input: OfferInput) {
    return this.uow.transaction(async (repos) => {
      const product = await repos.products.findById(organizationId, input.productId);
      if (!product) throw new NotFoundError("Product", input.productId);
      const offer = await repos.offers.update(organizationId, id, this.toRecord(input));
      if (!offer) throw new NotFoundError("Offer", id);
      await repos.audit.record({ organizationId, userId, action: "offer.updated", entity: "Offer", entityId: id, metadata: { amount: offer.amount, currency: offer.currency } });
      return offer;
    });
  }

  async setActive(organizationId: string, userId: string, id: string, active: boolean) {
    return this.uow.transaction(async (repos) => {
      const offer = await repos.offers.update(organizationId, id, { active });
      if (!offer) throw new NotFoundError("Offer", id);
      await repos.audit.record({ organizationId, userId, action: active ? "offer.activated" : "offer.deactivated", entity: "Offer", entityId: id });
      return offer;
    });
  }

  private toRecord(input: OfferInput) {
    const currency = assertSupportedCurrency(input.currency);
    const amount = parseDecimalToMinorUnits(input.price, currency);
    if (amount <= 0n) throw new ValidationError("O preço deve ser maior que zero", { field: "price" });
    return {
      productId: input.productId,
      name: input.name,
      amount,
      currency,
      billingType: input.billingType,
      installments: input.billingType === "INSTALLMENTS" ? (input.installments ?? null) : null,
      billingInterval: input.billingType === "SUBSCRIPTION" ? (input.billingInterval ?? null) : null,
      trialDays: input.billingType === "SUBSCRIPTION" ? (input.trialDays ?? null) : null,
      active: input.active,
    };
  }
}
