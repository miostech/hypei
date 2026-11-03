import type { EmailDictionary } from "./pt";

const en: EmailDictionary = {
  localeTag: "en",

  greeting: "Hello",
  fallbackPurchaseProduct: "your order",
  fallbackRefundProduct: "your purchase",

  footer: {
    soldBy: "This purchase was made with {seller}.",
    support: "Questions? Reply to this email or write to {email}.",
    processedBy: "Payment processed by Kabrun.",
  },

  purchaseConfirmed: {
    subject: "Purchase confirmed: {product}",
    preheader: "Your payment of {amount} has been confirmed.",
    heading: "Payment confirmed",
    introWithAccess: "{name}, we received your payment and your access is already open.",
    introWithoutAccess: "{name}, we received your payment. {seller} will be in touch with the next steps.",
    rowProduct: "Product",
    rowAmount: "Amount",
    rowOrder: "Order",
    rowAlsoBought: "Also in this order",
    noteExtras: "The other products are in your member area, with the same email address.",
    cta: "Open the content",
    note: "Sign in with the same email you used for this purchase.",
  },

  refundCompleted: {
    subject: "Refund of {amount}",
    preheader: "Your refund of {amount} has been processed.",
    heading: "Refund processed",
    intro: "{name}, the refund for your purchase has been processed.",
    rowProduct: "Product",
    rowAmount: "Amount refunded",
    note: "How long the amount takes to show on your statement depends on your bank or card network, usually up to two billing cycles.",
  },
};

export default en;
