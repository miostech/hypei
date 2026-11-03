import type { EmailDictionary } from "./pt";

const de: EmailDictionary = {
  localeTag: "de",

  greeting: "Hallo",
  fallbackPurchaseProduct: "Ihre Bestellung",
  fallbackRefundProduct: "Ihr Kauf",

  footer: {
    soldBy: "Dieser Kauf wurde bei {seller} getätigt.",
    support: "Fragen? Antworten Sie auf diese E-Mail oder schreiben Sie an {email}.",
    processedBy: "Zahlung abgewickelt von Kabrun.",
  },

  purchaseConfirmed: {
    subject: "Kauf bestätigt: {product}",
    preheader: "Ihre Zahlung über {amount} wurde bestätigt.",
    heading: "Zahlung bestätigt",
    introWithAccess: "{name}, wir haben Ihre Zahlung erhalten und Ihr Zugang ist bereits freigeschaltet.",
    introWithoutAccess: "{name}, wir haben Ihre Zahlung erhalten. {seller} meldet sich mit den nächsten Schritten bei Ihnen.",
    rowProduct: "Produkt",
    rowAmount: "Betrag",
    rowOrder: "Bestellung",
    cta: "Zum Inhalt",
    note: "Melden Sie sich mit der E-Mail-Adresse an, die Sie für diesen Kauf verwendet haben.",
  },

  refundCompleted: {
    subject: "Rückerstattung über {amount}",
    preheader: "Ihre Rückerstattung über {amount} wurde bearbeitet.",
    heading: "Rückerstattung bearbeitet",
    intro: "{name}, die Rückerstattung für Ihren Kauf wurde bearbeitet.",
    rowProduct: "Produkt",
    rowAmount: "Erstatteter Betrag",
    note: "Wie lange es dauert, bis der Betrag auf Ihrer Abrechnung erscheint, hängt von Ihrer Bank oder Kartenmarke ab, in der Regel bis zu zwei Abrechnungszeiträume.",
  },
};

export default de;
