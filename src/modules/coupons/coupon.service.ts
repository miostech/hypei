import type { Coupon } from "@/generated/prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { assertSupportedCurrency, parseDecimalToMinorUnits } from "@/lib/money";
import type { Repositories } from "@/server/repositories";
import type { UnitOfWork } from "@/server/unit-of-work";
import { normalizeCouponCode, type CouponInput } from "./coupon.schemas";

/** Why a coupon cannot be used, in the words the buyer sees. */
export class CouponNotUsableError extends ValidationError {
  constructor(message: string) {
    super(message, { field: "couponCode" });
  }
}

export interface CouponCheck {
  coupon: Coupon;
  discount: bigint;
  total: bigint;
}

/**
 * Discount rules. The math is integer-only and the discount is always rounded
 * down, so a percentage never gives away more than it promises.
 */
export class CouponService {
  constructor(private readonly uow: UnitOfWork) {}

  list(organizationId: string) {
    return this.uow.repos.coupons.list(organizationId);
  }

  async get(organizationId: string, id: string) {
    const coupon = await this.uow.repos.coupons.findById(organizationId, id);
    if (!coupon) throw new NotFoundError("Coupon", id);
    return coupon;
  }

  async create(organizationId: string, userId: string, input: CouponInput) {
    // Normalized here too: the schema does it for form input, but a service call
    // from a script or an import must not create "unico" next to "UNICO".
    const code = normalizeCouponCode(input.code);
    return this.uow.transaction(async (repos) => {
      const existing = await repos.coupons.findByCode(organizationId, code);
      if (existing) throw new ConflictError(`Já existe um cupom com o código ${code}`);
      await this.assertProduct(repos, organizationId, input.productId);

      const coupon = await repos.coupons.create({
        organizationId,
        ...this.toRecord(input),
      });
      await repos.audit.record({
        organizationId,
        userId,
        action: "coupon.created",
        entity: "Coupon",
        entityId: coupon.id,
        metadata: { code: coupon.code },
      });
      return coupon;
    });
  }

  async update(organizationId: string, userId: string, id: string, input: CouponInput) {
    return this.uow.transaction(async (repos) => {
      const current = await repos.coupons.findById(organizationId, id);
      if (!current) throw new NotFoundError("Coupon", id);

      const code = normalizeCouponCode(input.code);
      const duplicate = await repos.coupons.findByCode(organizationId, code);
      if (duplicate && duplicate.id !== id) throw new ConflictError(`Já existe um cupom com o código ${code}`);
      await this.assertProduct(repos, organizationId, input.productId);

      const coupon = await repos.coupons.update(organizationId, id, this.toRecord(input));
      await repos.audit.record({
        organizationId,
        userId,
        action: "coupon.updated",
        entity: "Coupon",
        entityId: id,
        metadata: { code: coupon.code },
      });
      return coupon;
    });
  }

  async setActive(organizationId: string, userId: string, id: string, active: boolean) {
    await this.uow.transaction(async (repos) => {
      await repos.coupons.update(organizationId, id, { active });
      await repos.audit.record({
        organizationId,
        userId,
        action: active ? "coupon.activated" : "coupon.deactivated",
        entity: "Coupon",
        entityId: id,
      });
    });
  }

  async remove(organizationId: string, userId: string, id: string) {
    await this.uow.transaction(async (repos) => {
      const coupon = await repos.coupons.findById(organizationId, id);
      if (!coupon) throw new NotFoundError("Coupon", id);
      if (coupon.redemptions > 0) {
        throw new ValidationError("Este cupom já foi usado; desative-o em vez de excluir");
      }
      await repos.coupons.remove(organizationId, id);
      await repos.audit.record({ organizationId, userId, action: "coupon.deleted", entity: "Coupon", entityId: id });
    });
  }

  /**
   * Checks a code against an order about to be created. Read-only: nothing is
   * reserved here, so the checkout claims the redemption again when it commits.
   */
  async check(
    organizationId: string,
    code: string,
    order: { amount: bigint; currency: string; productId: string; customerId?: string | null },
    now = new Date(),
  ): Promise<CouponCheck> {
    const coupon = await this.uow.repos.coupons.findByCode(organizationId, normalizeCouponCode(code));
    if (!coupon) throw new CouponNotUsableError("Cupom não encontrado");
    if (!coupon.active) throw new CouponNotUsableError("Este cupom não está mais ativo");
    if (coupon.expiresAt && coupon.expiresAt <= now) throw new CouponNotUsableError("Este cupom expirou");
    if (coupon.maxRedemptions !== null && coupon.redemptions >= coupon.maxRedemptions) {
      throw new CouponNotUsableError("Este cupom atingiu o limite de usos");
    }
    if (coupon.productId && coupon.productId !== order.productId) {
      throw new CouponNotUsableError("Este cupom não vale para este produto");
    }
    if (coupon.currency && coupon.currency !== order.currency) {
      throw new CouponNotUsableError("Este cupom não vale para esta moeda");
    }
    if (coupon.minAmount !== null && order.amount < coupon.minAmount) {
      throw new CouponNotUsableError("O valor da compra é menor que o mínimo do cupom");
    }
    if (coupon.oncePerCustomer && order.customerId) {
      const used = await this.uow.repos.coupons.countCustomerRedemptions(coupon.id, order.customerId);
      if (used > 0) throw new CouponNotUsableError("Você já usou este cupom");
    }

    const discount = this.discountFor(coupon, order.amount);
    if (discount <= 0n) throw new CouponNotUsableError("Este cupom não gera desconto nesta compra");
    if (discount >= order.amount) throw new CouponNotUsableError("O desconto não pode zerar o valor da compra");

    return { coupon, discount, total: order.amount - discount };
  }

  /** Rounded down: a 10% coupon on R$ 99,99 takes R$ 9,99, never R$ 10,00. */
  discountFor(coupon: Coupon, amount: bigint): bigint {
    if (coupon.type === "PERCENTAGE") {
      const bps = BigInt(coupon.percentageBps ?? 0);
      return (amount * bps) / 10_000n;
    }
    const fixed = coupon.amount ?? 0n;
    return fixed > amount ? amount : fixed;
  }

  private async assertProduct(repos: Repositories, organizationId: string, productId?: string) {
    if (!productId) return;
    const product = await repos.products.findById(organizationId, productId);
    if (!product) throw new NotFoundError("Product", productId);
  }

  private toRecord(input: CouponInput) {
    const currency = assertSupportedCurrency(input.currency);
    const percentageBps =
      input.type === "PERCENTAGE" && input.percentage
        ? Number(parseDecimalToMinorUnits(input.percentage, "BRL")) // "10,5" → 1050 bps
        : null;

    return {
      code: normalizeCouponCode(input.code),
      type: input.type,
      percentageBps,
      amount: input.type === "FIXED_AMOUNT" && input.amount ? parseDecimalToMinorUnits(input.amount, currency) : null,
      currency,
      minAmount: input.minAmount ? parseDecimalToMinorUnits(input.minAmount, currency) : null,
      productId: input.productId || null,
      maxRedemptions: input.maxRedemptions ?? null,
      oncePerCustomer: input.oncePerCustomer,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      active: input.active,
    };
  }
}
