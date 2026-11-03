import type { CheckoutDictionary } from "./pt";

const en: CheckoutDictionary = {
  localeTag: "en",

  page: {
    title: "{product} — Checkout",
    titleFallback: "Checkout",
  },

  notLive: {
    title: "Checkout not open yet",
    body: "{seller} is still finishing the verification of their payout account. Nothing is charged until then.",
    support: "Questions: {email}.",
  },

  form: {
    title: "Your details",
    name: "Full name",
    namePlaceholder: "As on your ID",
    email: "Email",
    emailPlaceholder: "you@email.com",
    emailHint: "This is the address we'll send your access to.",
    phone: "Phone",
    country: "Country",
    submit: "Continue to payment · {amount}",
  },

  coupon: {
    label: "Discount code",
    placeholder: "Have a code?",
    apply: "Apply",
    remove: "Remove",
    applied: "Code {code} applied",
    line: "Code {code}",
  },

  payment: {
    title: "Payment",
    pay: "Pay {amount}",
    methods: "Available payment methods: {methods}.",
    failed: "We couldn't complete the payment.",
  },

  summary: {
    title: "Order summary",
    subtotal: "Subtotal",
    total: "Total",
  },

  trust: {
    secure: "Payment processed securely",
    guarantee: "{days}-day guarantee",
    emailAccess: "Access sent by email",
  },

  soldBy: "Sold by {seller}",
  processedBy: "Payment processed by {brand}",

  methodNames: {
    CREDIT_CARD: "Credit card",
    DEBIT_CARD: "Debit card",
    PIX: "Pix",
    BOLETO: "Boleto",
    SEPA_DEBIT: "SEPA Direct Debit",
    BANK_TRANSFER: "Bank transfer",
    APPLE_PAY: "Apple Pay",
    GOOGLE_PAY: "Google Pay",
    PAYPAL: "PayPal",
  },

  errors: {
    rateLimited: "Too many attempts. Wait a moment and try again.",
    invalidName: "Enter your name",
    invalidEmail: "Invalid email address",
    invalidData: "Invalid details",
    invalidCode: "Invalid code",
    startFailed: "We couldn't start the payment. Please try again.",
    couponFailed: "We couldn't validate the code.",
    checkoutNotLive: "This checkout isn't open for payments yet. Get in touch with the seller.",
    coupon: {
      notFound: "Code not found",
      inactive: "This code is no longer active",
      expired: "This code has expired",
      maxRedemptions: "This code has reached its usage limit",
      wrongProduct: "This code doesn't apply to this product",
      wrongCurrency: "This code doesn't apply to this currency",
      belowMinimum: "The order is below this code's minimum",
      alreadyUsed: "You've already used this code",
      noDiscount: "This code gives no discount on this order",
      zeroesTotal: "The discount can't bring the order down to zero",
    },
  },

  result: {
    title: "Payment",
    paid: {
      title: "Payment confirmed!",
      body: "We've sent your access details for {product} to your email.",
    },
    failed: {
      title: "Payment not approved",
      body: "Nothing was charged. You can try again with another payment method.",
    },
    pending: {
      title: "We're confirming your payment",
      body: "This usually takes a few seconds. This page updates on its own.",
    },
    access: "Access now",
    accessHint: "Sign in with the same email you used for this purchase.",
    watching: "Waiting for confirmation from the payment provider…",
  },
};

export default en;
