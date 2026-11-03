import { randomUUID } from "node:crypto";
import type { PaymentMethodType, PaymentProviderType } from "@/generated/prisma/enums";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { createDomainEvent } from "@/lib/events/domain-event";
import type { IdempotencyService } from "@/lib/idempotency/idempotency.service";
import type { TrackingService } from "@/modules/analytics/tracking.service";
import { resolvePaymentMethods } from "@/modules/payments/payment-method-resolver";
import type { PaymentService } from "@/modules/payments/payment.service";
import { assertUploadableImage } from "@/lib/images";
import { buildAssetKey, signImage, type StorageProvider } from "@/lib/providers/storage";
import type { UnitOfWork } from "@/server/unit-of-work";
import type { CheckoutConfigRepository } from "./checkout-config.repository";
import { checkoutConfigSchema, type CheckoutConfig } from "./checkout-config.schema";
import type { AffiliateService } from "@/modules/affiliates/affiliate.service";
import type { SubscriptionService } from "@/modules/subscriptions/subscription.service";
import { assertSupportedCurrency, money, parseDecimalToMinorUnits } from "@/lib/money";
import type { TaxService } from "@/modules/taxes/tax.service";
import { CouponNotUsableError, type CouponService } from "@/modules/coupons/coupon.service";
import type { CheckoutBuilderInput, OrderBumpInput, StartCheckoutInput } from "./checkout.schemas";

/**
 * Um bump como a página de compra precisa dele: já casado com a oferta que entrega, e com o
 * preço convertido para `bigint`, que é a única forma em que dinheiro circula aqui dentro.
 */
export interface PublicOrderBump {
  offerId: string;
  productName: string;
  headline: string;
  description: string;
  amount: bigint;
  compareAtAmount: bigint | null;
}

export interface StartCheckoutResult {
  orderId: string;
  paymentId: string;
  provider: PaymentProviderType;
  clientSecret: string | null;
}

/**
 * PostgreSQL configures business (checkout row → offer → official price).
 * MongoDB configures presentation (versioned checkout_configs).
 */
export class CheckoutService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly configs: CheckoutConfigRepository,
    private readonly payments: PaymentService,
    private readonly tracking: TrackingService,
    private readonly idempotency: IdempotencyService,
    private readonly coupons: CouponService,
    private readonly affiliates: AffiliateService,
    private readonly subscriptions: SubscriptionService,
    private readonly providerType: PaymentProviderType,
    private readonly taxes: TaxService,
    private readonly storage: StorageProvider,
  ) {}

  /**
   * Autoriza o envio de uma arte do checkout — banner ou logo — direto para o storage. O
   * arquivo nunca passa pelo servidor: o navegador pede aqui, recebe uma URL que expira e manda
   * os bytes para o bucket. Qual campo guarda a chave é decisão de quem chama.
   */
  async createImageUpload(
    organizationId: string,
    checkoutId: string,
    input: { filename: string; contentType: string; sizeBytes: number },
  ) {
    const checkout = await this.uow.repos.checkouts.findById(organizationId, checkoutId);
    if (!checkout) throw new NotFoundError("Checkout", checkoutId);
    assertUploadableImage(input);

    const key = buildAssetKey({ organizationId, scope: "checkouts", scopeId: checkoutId, filename: input.filename, id: randomUUID() });
    return this.storage.createUpload({ key, contentType: input.contentType });
  }

  /** URL curta para mostrar banner, logo ou capa. Sem imagem a página continua vendendo. */
  assetUrl(key: string | null): Promise<string | null> {
    return signImage(this.storage, key);
  }

  list(organizationId: string) {
    return this.uow.repos.checkouts.list(organizationId);
  }

  async getForEdit(organizationId: string, id: string) {
    const checkout = await this.uow.repos.checkouts.findById(organizationId, id);
    if (!checkout) throw new NotFoundError("Checkout", id);
    const config = await this.configs.getVersion(checkout.id, checkout.currentVersion);
    return { checkout, config: config?.config ?? null };
  }

  async create(organizationId: string, userId: string, input: CheckoutBuilderInput) {
    const offer = await this.uow.repos.offers.findById(organizationId, input.offerId);
    if (!offer) throw new NotFoundError("Offer", input.offerId);
    if (await this.uow.repos.checkouts.slugExists(input.slug)) throw new ConflictError("Este link já está em uso", { field: "slug" });
    const bumps = await this.resolveBumps(organizationId, { offerId: offer.id, productId: offer.productId, currency: offer.currency }, input.orderBumps);

    const checkoutId = `chk_${randomUUID().replace(/-/g, "")}`;
    // Mongo first: if Postgres fails afterwards the orphan version is harmless (never referenced).
    await this.configs.createVersion({ checkoutId, organizationId, version: 1, config: this.toConfig(input, bumps) });
    return this.uow.transaction(async (repos) => {
      const checkout = await repos.checkouts.create({ id: checkoutId, organizationId, offerId: offer.id, slug: input.slug, name: input.name });
      await repos.audit.record({ organizationId, userId, action: "checkout.created", entity: "Checkout", entityId: checkout.id });
      return checkout;
    });
  }

  /** Every change produces a NEW version; orders keep pointing at the version the buyer saw. */
  async updateConfig(organizationId: string, userId: string, id: string, input: CheckoutBuilderInput) {
    const checkout = await this.uow.repos.checkouts.findById(organizationId, id);
    if (!checkout) throw new NotFoundError("Checkout", id);
    const offer = await this.uow.repos.offers.findById(organizationId, input.offerId);
    if (!offer) throw new NotFoundError("Offer", input.offerId);
    if (offer.id !== checkout.offerId) throw new ValidationError("A oferta de um checkout não pode ser trocada; crie um novo checkout");

    const bumps = await this.resolveBumps(organizationId, { offerId: offer.id, productId: offer.productId, currency: offer.currency }, input.orderBumps);

    const latest = await this.configs.latest(checkout.id);
    const version = (latest?.version ?? checkout.currentVersion) + 1;
    await this.configs.createVersion({ checkoutId: checkout.id, organizationId, version, config: this.toConfig(input, bumps) });
    await this.uow.transaction(async (repos) => {
      await repos.checkouts.setVersion(organizationId, checkout.id, version);
      await repos.audit.record({ organizationId, userId, action: "checkout.updated", entity: "Checkout", entityId: checkout.id, metadata: { version } });
    });
    return { version };
  }

  async getPublic(slug: string) {
    const checkout = await this.uow.repos.checkouts.findPublicBySlug(slug);
    if (!checkout || checkout.status !== "ACTIVE" || !checkout.offer.active || checkout.offer.product.status !== "ACTIVE") {
      return null;
    }
    // A tela de Verificação promete ao produtor que o checkout não cobra antes de ele
    // verificar. Sem consultar a conta do provedor aqui, a promessa era falsa.
    const merchant = await this.uow.repos.merchantAccounts.findByOrganization(checkout.organizationId, this.providerType);
    const stored = await this.configs.getVersion(checkout.id, checkout.currentVersion);
    const config: CheckoutConfig = stored ? checkoutConfigSchema.parse(stored.config) : checkoutConfigSchema.parse({ theme: {}, headline: checkout.offer.product.name, fields: {} });
    const paymentMethods: PaymentMethodType[] = resolvePaymentMethods({
      provider: this.providerType,
      currency: checkout.offer.currency,
      merchantCountry: checkout.organization.country,
      checkoutEnabledMethods: config.enabledPaymentMethods,
    });
    return {
      checkoutId: checkout.id,
      version: checkout.currentVersion,
      provider: this.providerType,
      /** False while the provider has not enabled charges: the page hides the form. */
      acceptsPayments: merchant?.chargesEnabled ?? false,
      organization: { id: checkout.organization.id, name: checkout.organization.name, slug: checkout.organization.slug, country: checkout.organization.country, supportEmail: checkout.organization.supportEmail },
      product: { id: checkout.offer.product.id, name: checkout.offer.product.name, description: checkout.offer.product.description, type: checkout.offer.product.type, thumbnailKey: checkout.offer.product.thumbnailKey },
      // Official price: ALWAYS from the Offer in PostgreSQL.
      offer: {
        id: checkout.offer.id,
        name: checkout.offer.name,
        amount: checkout.offer.amount,
        currency: checkout.offer.currency,
        billingType: checkout.offer.billingType,
        billingInterval: checkout.offer.billingInterval,
        trialDays: checkout.offer.trialDays,
        installments: checkout.offer.installments,
      },
      config,
      /** Já filtrados pelo que ainda é vendável; o `config.orderBumps` cru fica para quem edita. */
      orderBumps: await this.publicBumps(checkout.organizationId, config, checkout.offer.currency),
      paymentMethods,
    };
  }

  /** Idempotent per checkout attempt: double-clicks/retries never create two orders. */
  async start(input: StartCheckoutInput): Promise<StartCheckoutResult> {
    // The client secret is never persisted: only ids are stored for replays, and the secret
    // is re-fetched from the provider when the same attempt is retried.
    let freshSecret: string | null = null;
    const stored = await this.idempotency.run("checkout.start", input.attemptId, { ...input, tracking: undefined }, async () => {
      const result = await this.createOrderAndPayment(input);
      freshSecret = result.clientSecret;
      return { orderId: result.orderId, paymentId: result.paymentId, provider: result.provider };
    });
    const clientSecret = freshSecret ?? (await this.payments.resumeClientSecret(stored.paymentId));
    return { orderId: stored.orderId, paymentId: stored.paymentId, provider: stored.provider, clientSecret };
  }

  /**
   * Validates a code against the public checkout so the buyer sees the discount
   * before paying. Nothing is reserved: the redemption is only claimed on submit.
   */
  async previewCoupon(slug: string, code: string) {
    const checkout = await this.getPublic(slug);
    if (!checkout) throw new NotFoundError("Checkout", slug);
    const { coupon, discount, total } = await this.coupons.check(checkout.organization.id, code, {
      amount: checkout.offer.amount,
      currency: checkout.offer.currency,
      productId: checkout.product.id,
    });
    return { code: coupon.code, discount, total, currency: checkout.offer.currency };
  }

  private async createOrderAndPayment(input: StartCheckoutInput): Promise<StartCheckoutResult> {
    const checkout = await this.getPublic(input.slug);
    if (!checkout) throw new NotFoundError("Checkout", input.slug);
    // A trava de verdade é esta, não a da tela: sem ela o produtor vendia, o dinheiro entrava
    // e o saque ficava bloqueado — com o comprador já cobrado e sem caminho de volta barato.
    if (!checkout.acceptsPayments) {
      // `reason` é a chave da frase no dicionário do comprador: quem compra de fora lê isto
      // no idioma dele, e não em português.
      throw new ValidationError("Este checkout ainda não está liberado para receber pagamentos. Fale com quem está vendendo.", {
        reason: "checkoutNotLive",
      });
    }
    const { organization, offer } = checkout;
    // O que o comprador marcou, relido da versão corrente: o navegador mandou ids, e o preço
    // de cada um sai daqui. Id repetido ou desconhecido simplesmente não encontra par.
    const chosen = new Set(input.bumpOfferIds ?? []);
    const bumps = checkout.orderBumps.filter((bump) => chosen.has(bump.offerId));
    const bumpTotal = bumps.reduce((sum, bump) => sum + bump.amount, 0n);

    const { customer, order, total, subscription } = await this.uow.transaction(async (repos) => {
      const customer = await repos.customers.upsertByEmail(organization.id, {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        country: input.country ?? null,
        locale: input.locale ?? null,
      });

      // The discount is recomputed here from the offer price: whatever the browser
      // sent is only a code, never an amount.
      const applied = input.couponCode
        ? await this.coupons.check(organization.id, input.couponCode, {
            amount: offer.amount,
            currency: offer.currency,
            productId: checkout.product.id,
            customerId: customer.id,
          })
        : null;

      if (applied) {
        const claimed = await repos.coupons.claimRedemption(applied.coupon.id);
        if (!claimed) throw new CouponNotUsableError("maxRedemptions", "Este cupom atingiu o limite de usos");
      }

      const discount = applied?.discount ?? 0n;
      // O cupom desconta só a oferta principal. Ele é restrito por produto, e um código criado
      // para o curso não deveria derrubar o preço de um bump que o produtor pôs ao lado.
      const offerTotal = offer.amount - discount;
      const total = offerTotal + bumpTotal;

      // Quem vende é o produtor, e o preço anunciado já inclui o imposto: isto apenas
      // identifica quanto do que ele recebe é tributo. Nenhum dinheiro muda de mãos aqui.
      const tax = await this.taxes.calculate({
        amount: money(total, offer.currency),
        organizationId: organization.id,
        sellerCountry: checkout.organization.country,
        buyerCountry: input.country ?? null,
        productType: checkout.product.type,
      });

      // Attribution is resolved now and frozen on the order: changing the
      // affiliate's rate later must not rewrite what an old sale owed.
      const attribution = input.referralCode
        ? await this.affiliates.resolveAttribution(organization.id, input.referralCode)
        : null;

      const order = await repos.orders.create({
        organizationId: organization.id,
        customerId: customer.id,
        checkoutId: checkout.checkoutId,
        checkoutVersion: checkout.version,
        currency: offer.currency,
        subtotalAmount: offer.amount + bumpTotal,
        discountAmount: discount,
        couponId: applied?.coupon.id ?? null,
        couponCode: applied?.coupon.code ?? null,
        affiliateId: attribution?.affiliateId ?? null,
        affiliateLinkId: attribution?.linkId ?? null,
        taxAmount: tax.taxAmount.amount,
        taxRegime: tax.regime,
        totalAmount: total,
        tracking: { ...input.tracking, sessionId: input.sessionId },
        items: [
          { offerId: offer.id, productName: checkout.product.name, offerName: offer.name, quantity: 1, unitAmount: offer.amount, totalAmount: offerTotal },
          // Cada bump vira item com o valor que foi cobrado por ele. É este registro que
          // responde "quanto custou" amanhã, não a versão do checkout.
          ...bumps.map((bump) => ({
            offerId: bump.offerId,
            productName: bump.productName,
            offerName: bump.headline,
            quantity: 1,
            unitAmount: bump.amount,
            totalAmount: bump.amount,
          })),
        ],
      });

      if (applied) {
        await repos.coupons.recordRedemption({
          couponId: applied.coupon.id,
          orderId: order.id,
          customerId: customer.id,
          amount: discount,
        });
      }

      // A recurring offer starts a subscription right here; the payment created
      // below is its first cycle, and the provider drives the ones after that.
      const subscription =
        offer.billingType === "SUBSCRIPTION" && offer.billingInterval
          ? await this.subscriptions.createFromCheckout(repos, {
              organizationId: organization.id,
              customerId: customer.id,
              offerId: offer.id,
              // `offerTotal`, não `total`: o bump é cobrado uma vez, na primeira fatura. Levar
              // o valor dele para a assinatura cobraria a planilha de novo todo mês, para
              // sempre, sem nada na tela dizendo por quê.
              amount: offerTotal,
              currency: offer.currency,
              billingInterval: offer.billingInterval,
              trialDays: offer.trialDays ?? null,
              startedAt: new Date(),
            })
          : null;

      await repos.outbox.add(createDomainEvent("order.created", order.id, organization.id, { total, currency: offer.currency }));
      return { customer, order, total, subscription };
    });

    const base = { organizationId: organization.id, checkoutId: checkout.checkoutId, sessionId: input.sessionId, tracking: input.tracking };
    await this.tracking.trackCheckout({ ...base, eventType: "checkout.customer_created", customerId: customer.id, orderId: order.id });

    const payment = await this.payments.start({
      organizationId: organization.id,
      orderId: order.id,
      subscriptionId: subscription?.id ?? null,
      customer: { id: customer.id, email: customer.email, name: customer.name, country: customer.country },
      amount: total,
      currency: offer.currency,
      paymentMethods: checkout.paymentMethods,
      description: bumps.length > 0
        ? `${checkout.product.name} — ${offer.name} (+${bumps.map((bump) => bump.productName).join(", ")})`
        : `${checkout.product.name} — ${offer.name}`,
      offerId: offer.id,
    });
    await this.tracking.trackCheckout({ ...base, eventType: "checkout.payment_started", customerId: customer.id, orderId: order.id });

    return { orderId: order.id, paymentId: payment.paymentId, provider: payment.provider, clientSecret: payment.clientSecret };
  }

  /**
   * Converte os bumps digitados pelo produtor no que vai gravado na versão, recusando o que
   * não pode ser vendido junto.
   *
   * Cada regra aqui existe por um motivo de dinheiro ou de entrega, e não por gosto:
   *
   * - **Moeda igual à da oferta principal.** O pedido tem uma moeda só e a cobrança é uma só.
   * - **Nunca a própria oferta, nem outra oferta do mesmo produto.** O acesso é por produto:
   *   cobrar duas vezes entregaria uma vez, e o comprador teria razão em pedir de volta.
   * - **Só oferta de cobrança única.** Assinatura como bump seria cobrada uma vez e nunca
   *   renovaria — o comprador pagaria um mês e ficaria com acesso para sempre, em silêncio.
   * - **Oferta e produto ativos.** O bump promete entrega; produto arquivado não entrega.
   * - **Preço riscado maior que o preço cobrado.** Âncora menor que o valor não é desconto,
   *   é mentira na vitrine.
   */
  private async resolveBumps(
    organizationId: string,
    main: { offerId: string; productId: string; currency: string },
    inputs: OrderBumpInput[],
  ): Promise<CheckoutConfig["orderBumps"]> {
    const currency = assertSupportedCurrency(main.currency);
    const seen = new Set<string>();
    const resolved: CheckoutConfig["orderBumps"] = [];

    for (const [index, input] of inputs.entries()) {
      const at = (field: string) => ({ field: `orderBumps.${index}.${field}` });
      if (seen.has(input.offerId)) throw new ValidationError("Esta oferta já está em outro bump deste checkout", at("offerId"));
      seen.add(input.offerId);

      const offer = await this.uow.repos.offers.findById(organizationId, input.offerId);
      if (!offer) throw new NotFoundError("Offer", input.offerId);
      if (offer.id === main.offerId) throw new ValidationError("O bump não pode ser a própria oferta do checkout", at("offerId"));
      if (offer.productId === main.productId) throw new ValidationError("O bump precisa ser de outro produto: o acesso é por produto, e cobrar duas vezes entregaria uma", at("offerId"));
      if (offer.currency !== currency) throw new ValidationError(`O bump precisa ser na mesma moeda do checkout (${currency})`, at("offerId"));
      if (offer.billingType !== "ONE_TIME") throw new ValidationError("Só oferta de cobrança única pode ser bump: assinatura seria cobrada uma vez e nunca renovaria", at("offerId"));
      if (!offer.active) throw new ValidationError("Esta oferta está inativa", at("offerId"));
      if (offer.product.status !== "ACTIVE") throw new ValidationError("O produto desta oferta não está ativo", at("offerId"));

      const amount = parseDecimalToMinorUnits(input.price, currency);
      if (amount <= 0n) throw new ValidationError("O preço do bump precisa ser maior que zero", at("price"));
      const compareAtAmount = input.compareAtPrice ? parseDecimalToMinorUnits(input.compareAtPrice, currency) : null;
      if (compareAtAmount !== null && compareAtAmount <= amount) {
        throw new ValidationError("O preço riscado precisa ser maior que o preço cobrado", at("compareAtPrice"));
      }

      resolved.push({
        offerId: offer.id,
        headline: input.headline,
        description: input.description || "",
        amount: Number(amount),
        compareAtAmount: compareAtAmount === null ? null : Number(compareAtAmount),
      });
    }
    return resolved;
  }

  /**
   * As ofertas que PODEM ser bump deste checkout.
   *
   * Mesma regra de `resolveBumps`, do outro lado: ali ela recusa, aqui ela filtra o que o
   * produtor pode escolher. Duas listas divergentes dariam um seletor que oferece o que o
   * salvamento recusa — por isso as duas leem os mesmos critérios.
   */
  async bumpCandidates(organizationId: string, mainOfferId: string) {
    const main = await this.uow.repos.offers.findById(organizationId, mainOfferId);
    if (!main) throw new NotFoundError("Offer", mainOfferId);

    return (await this.uow.repos.offers.list(organizationId)).filter(
      (offer) =>
        offer.id !== main.id &&
        offer.productId !== main.productId &&
        offer.currency === main.currency &&
        offer.billingType === "ONE_TIME" &&
        offer.active &&
        offer.product.status === "ACTIVE",
    );
  }

  /**
   * Monta os bumps para a página pública, descartando em silêncio o que deixou de ser
   * vendável — oferta desativada, produto arquivado, oferta apagada.
   *
   * Descartar é de propósito. O produtor pausa um produto e isso não pode derrubar a venda do
   * produto principal: o checkout continua de pé, só sem aquela caixa.
   */
  private async publicBumps(organizationId: string, config: CheckoutConfig, currency: string): Promise<PublicOrderBump[]> {
    const bumps: PublicOrderBump[] = [];
    for (const bump of config.orderBumps) {
      const offer = await this.uow.repos.offers.findById(organizationId, bump.offerId);
      if (!offer || !offer.active || offer.product.status !== "ACTIVE" || offer.currency !== currency) continue;
      bumps.push({
        offerId: offer.id,
        productName: offer.product.name,
        headline: bump.headline,
        description: bump.description,
        amount: BigInt(bump.amount),
        compareAtAmount: bump.compareAtAmount === null ? null : BigInt(bump.compareAtAmount),
      });
    }
    return bumps;
  }

  private toConfig(input: CheckoutBuilderInput, orderBumps: CheckoutConfig["orderBumps"]): CheckoutConfig {
    return checkoutConfigSchema.parse({
      theme: { mode: "light", accentColor: input.accentColor },
      logoKey: input.logoKey || null,
      bannerKey: input.bannerKey || null,
      headline: input.headline,
      description: input.description ?? "",
      fields: { phone: input.collectPhone, country: true },
      enabledPaymentMethods: input.enabledPaymentMethods,
      orderBumps,
      guaranteeDays: input.guaranteeDays,
    });
  }
}
