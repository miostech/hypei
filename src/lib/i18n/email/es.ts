import type { EmailDictionary } from "./pt";

const es: EmailDictionary = {
  localeTag: "es",

  greeting: "Hola",
  fallbackPurchaseProduct: "tu pedido",
  fallbackRefundProduct: "tu compra",

  footer: {
    soldBy: "Esta compra se hizo con {seller}.",
    support: "¿Dudas? Responde a este correo o escribe a {email}.",
    processedBy: "Pago procesado por Kabrun.",
  },

  purchaseConfirmed: {
    subject: "Compra confirmada: {product}",
    preheader: "Tu pago de {amount} se ha confirmado.",
    heading: "Pago confirmado",
    introWithAccess: "{name}, recibimos tu pago y tu acceso ya está disponible.",
    introWithoutAccess: "{name}, recibimos tu pago. {seller} se pondrá en contacto contigo con los siguientes pasos.",
    rowProduct: "Producto",
    rowAmount: "Importe",
    rowOrder: "Pedido",
    rowAlsoBought: "También en la compra",
    noteExtras: "Los demás productos están en tu área de miembros, con el mismo correo.",
    cta: "Acceder al contenido",
    note: "Entra con el mismo correo que usaste en esta compra.",
  },

  refundCompleted: {
    subject: "Reembolso de {amount}",
    preheader: "Tu reembolso de {amount} se ha procesado.",
    heading: "Reembolso procesado",
    intro: "{name}, el reembolso de tu compra se ha procesado.",
    rowProduct: "Producto",
    rowAmount: "Importe devuelto",
    note: "El plazo para que el importe aparezca en tu extracto depende del banco o de la marca de la tarjeta, normalmente hasta dos ciclos de facturación.",
  },
};

export default es;
