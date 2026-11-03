import type { LocaleTag } from "../locale";

/**
 * Dicionário do comprador, em português. É a fonte da forma: os outros idiomas são tipados
 * contra `CheckoutDictionary`, então chave que falta lá não compila.
 *
 * As frases ficam inteiras, com {buraco} onde entra valor. Guardar pedaços ("Garantia de" +
 * "dias") amarraria toda tradução à ordem das palavras do português.
 */
const pt = {
  /** Etiqueta BCP-47 deste dicionário: o que o Intl, a Stripe e o atributo lang= entendem. */
  localeTag: "pt-BR" as LocaleTag,

  page: {
    title: "{product} — Checkout",
    titleFallback: "Checkout",
  },

  notLive: {
    title: "Checkout ainda não liberado",
    body: "{seller} ainda está concluindo a verificação da conta de recebimento. Nenhuma cobrança é feita até lá.",
    support: "Dúvidas: {email}.",
  },

  form: {
    title: "Seus dados",
    name: "Nome completo",
    namePlaceholder: "Como no documento",
    email: "E-mail",
    emailPlaceholder: "voce@email.com",
    emailHint: "É para este e-mail que enviaremos o acesso.",
    phone: "Telefone",
    country: "País",
    submit: "Ir para o pagamento · {amount}",
  },

  coupon: {
    label: "Cupom de desconto",
    placeholder: "Tem um cupom?",
    apply: "Aplicar",
    remove: "Remover",
    applied: "Cupom {code} aplicado",
    line: "Cupom {code}",
  },

  payment: {
    title: "Pagamento",
    pay: "Pagar {amount}",
    methods: "Formas de pagamento disponíveis: {methods}.",
    failed: "Não foi possível concluir o pagamento.",
  },

  summary: {
    title: "Resumo do pedido",
    subtotal: "Subtotal",
    total: "Total",
  },

  trust: {
    secure: "Pagamento processado com segurança",
    guarantee: "Garantia de {days} dias",
    emailAccess: "Acesso enviado por e-mail",
  },

  soldBy: "Vendido por {seller}",
  processedBy: "Pagamento processado por {brand}",

  /** Nomes dos meios de pagamento para o comprador. O app do produtor tem os seus, em pt-BR. */
  methodNames: {
    CREDIT_CARD: "Cartão de crédito",
    DEBIT_CARD: "Cartão de débito",
    PIX: "Pix",
    BOLETO: "Boleto",
    SEPA_DEBIT: "Débito SEPA",
    BANK_TRANSFER: "Transferência bancária",
    APPLE_PAY: "Apple Pay",
    GOOGLE_PAY: "Google Pay",
    PAYPAL: "PayPal",
  },

  /**
   * As chaves de `coupon` são os `reason` que `CouponNotUsableError` carrega, e as de fora são
   * do que a própria action decide. O tipo é o que garante que nenhum motivo de recusa chegue
   * ao comprador sem tradução — `dict.errors.coupon[reason]` não compila se faltar um.
   */
  errors: {
    rateLimited: "Muitas tentativas. Aguarde um instante e tente novamente.",
    invalidName: "Informe seu nome",
    invalidEmail: "E-mail inválido",
    invalidData: "Dados inválidos",
    invalidCode: "Código inválido",
    startFailed: "Não foi possível iniciar o pagamento. Tente novamente.",
    couponFailed: "Não foi possível validar o cupom.",
    checkoutNotLive: "Este checkout ainda não está liberado para receber pagamentos. Fale com quem está vendendo.",
    coupon: {
      notFound: "Cupom não encontrado",
      inactive: "Este cupom não está mais ativo",
      expired: "Este cupom expirou",
      maxRedemptions: "Este cupom atingiu o limite de usos",
      wrongProduct: "Este cupom não vale para este produto",
      wrongCurrency: "Este cupom não vale para esta moeda",
      belowMinimum: "O valor da compra é menor que o mínimo do cupom",
      alreadyUsed: "Você já usou este cupom",
      noDiscount: "Este cupom não gera desconto nesta compra",
      zeroesTotal: "O desconto não pode zerar o valor da compra",
    },
  },

  result: {
    title: "Pagamento",
    paid: {
      title: "Pagamento confirmado!",
      body: "Enviamos os dados de acesso a {product} para o seu e-mail.",
    },
    failed: {
      title: "Pagamento não aprovado",
      body: "Nenhum valor foi cobrado. Você pode tentar novamente com outro método de pagamento.",
    },
    pending: {
      title: "Estamos confirmando seu pagamento",
      body: "Isso costuma levar alguns segundos. Esta página atualiza sozinha.",
    },
    access: "Acessar agora",
    accessHint: "Entre com o mesmo e-mail que você usou nesta compra.",
    watching: "Aguardando confirmação do provedor de pagamento…",
  },
};

export type CheckoutDictionary = typeof pt;

export default pt;
