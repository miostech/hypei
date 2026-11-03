import type { CheckoutDictionary } from "./pt";

/** Tuteo, como é o padrão do comércio eletrônico em espanhol. */
const es: CheckoutDictionary = {
  localeTag: "es",

  page: {
    title: "{product} — Pago",
    titleFallback: "Pago",
  },

  notLive: {
    title: "Este pago aún no está habilitado",
    body: "{seller} todavía está completando la verificación de su cuenta de cobro. No se hace ningún cargo hasta entonces.",
    support: "¿Dudas? {email}.",
  },

  form: {
    title: "Tus datos",
    name: "Nombre completo",
    namePlaceholder: "Como en tu documento",
    email: "Correo electrónico",
    emailPlaceholder: "tu@email.com",
    emailHint: "A este correo te enviaremos el acceso.",
    phone: "Teléfono",
    country: "País",
    submit: "Ir al pago · {amount}",
  },

  coupon: {
    label: "Código de descuento",
    placeholder: "¿Tienes un código?",
    apply: "Aplicar",
    remove: "Quitar",
    applied: "Código {code} aplicado",
    line: "Código {code}",
  },

  payment: {
    title: "Pago",
    pay: "Pagar {amount}",
    methods: "Formas de pago disponibles: {methods}.",
    failed: "No se pudo completar el pago.",
  },

  summary: {
    title: "Resumen del pedido",
    subtotal: "Subtotal",
    total: "Total",
  },

  trust: {
    secure: "Pago procesado de forma segura",
    guarantee: "Garantía de {days} días",
    emailAccess: "Acceso enviado por correo electrónico",
  },

  soldBy: "Vendido por {seller}",
  processedBy: "Pago procesado por {brand}",

  methodNames: {
    CREDIT_CARD: "Tarjeta de crédito",
    DEBIT_CARD: "Tarjeta de débito",
    PIX: "Pix",
    BOLETO: "Boleto",
    SEPA_DEBIT: "Adeudo SEPA",
    BANK_TRANSFER: "Transferencia bancaria",
    APPLE_PAY: "Apple Pay",
    GOOGLE_PAY: "Google Pay",
    PAYPAL: "PayPal",
  },

  errors: {
    rateLimited: "Demasiados intentos. Espera un momento y vuelve a intentarlo.",
    invalidName: "Escribe tu nombre",
    invalidEmail: "Correo electrónico no válido",
    invalidData: "Datos no válidos",
    invalidCode: "Código no válido",
    startFailed: "No se pudo iniciar el pago. Vuelve a intentarlo.",
    couponFailed: "No se pudo validar el código.",
    checkoutNotLive: "Este pago aún no está habilitado. Habla con quien vende.",
    coupon: {
      notFound: "Código no encontrado",
      inactive: "Este código ya no está activo",
      expired: "Este código ha caducado",
      maxRedemptions: "Este código alcanzó su límite de usos",
      wrongProduct: "Este código no sirve para este producto",
      wrongCurrency: "Este código no sirve para esta moneda",
      belowMinimum: "El importe de la compra es menor que el mínimo del código",
      alreadyUsed: "Ya usaste este código",
      noDiscount: "Este código no genera descuento en esta compra",
      zeroesTotal: "El descuento no puede dejar la compra en cero",
    },
  },

  result: {
    title: "Pago",
    paid: {
      title: "¡Pago confirmado!",
      body: "Enviamos los datos de acceso a {product} a tu correo electrónico.",
    },
    failed: {
      title: "Pago no aprobado",
      body: "No se cobró ningún importe. Puedes intentarlo de nuevo con otro método de pago.",
    },
    pending: {
      title: "Estamos confirmando tu pago",
      body: "Suele tardar unos segundos. Esta página se actualiza sola.",
    },
    access: "Acceder ahora",
    accessHint: "Entra con el mismo correo que usaste en esta compra.",
    watching: "Esperando la confirmación del proveedor de pago…",
  },
};

export default es;
