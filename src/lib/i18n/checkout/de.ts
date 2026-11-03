import type { CheckoutDictionary } from "./pt";

/** Siezen, como é o padrão do comércio eletrônico em alemão. */
const de: CheckoutDictionary = {
  localeTag: "de",

  page: {
    title: "{product} — Bezahlung",
    titleFallback: "Bezahlung",
  },

  notLive: {
    title: "Bezahlung noch nicht freigegeben",
    body: "{seller} schließt die Verifizierung des Auszahlungskontos noch ab. Bis dahin wird nichts abgebucht.",
    support: "Fragen: {email}.",
  },

  form: {
    title: "Ihre Daten",
    name: "Vollständiger Name",
    namePlaceholder: "Wie im Ausweis",
    email: "E-Mail",
    emailPlaceholder: "name@email.com",
    emailHint: "An diese Adresse senden wir Ihren Zugang.",
    phone: "Telefon",
    country: "Land",
    submit: "Weiter zur Zahlung · {amount}",
  },

  coupon: {
    label: "Rabattcode",
    placeholder: "Haben Sie einen Code?",
    apply: "Anwenden",
    remove: "Entfernen",
    applied: "Code {code} angewendet",
    line: "Code {code}",
  },

  payment: {
    title: "Zahlung",
    pay: "{amount} bezahlen",
    methods: "Verfügbare Zahlungsarten: {methods}.",
    failed: "Die Zahlung konnte nicht abgeschlossen werden.",
  },

  bump: {
    title: "Gleich mitnehmen",
    add: "Hinzufügen",
    added: "Hinzugefügt",
    hint: "Kommt in dieselbe Bestellung, in derselben Zahlung.",
  },

  summary: {
    title: "Bestellübersicht",
    subtotal: "Zwischensumme",
    total: "Gesamt",
  },

  trust: {
    secure: "Zahlung sicher verarbeitet",
    guarantee: "{days} Tage Garantie",
    emailAccess: "Zugang per E-Mail",
  },

  soldBy: "Verkauft von {seller}",
  processedBy: "Zahlung abgewickelt von {brand}",

  methodNames: {
    CREDIT_CARD: "Kreditkarte",
    DEBIT_CARD: "Debitkarte",
    PIX: "Pix",
    BOLETO: "Boleto",
    SEPA_DEBIT: "SEPA-Lastschrift",
    BANK_TRANSFER: "Banküberweisung",
    APPLE_PAY: "Apple Pay",
    GOOGLE_PAY: "Google Pay",
    PAYPAL: "PayPal",
  },

  errors: {
    rateLimited: "Zu viele Versuche. Warten Sie einen Moment und versuchen Sie es erneut.",
    invalidName: "Geben Sie Ihren Namen ein",
    invalidEmail: "Ungültige E-Mail-Adresse",
    invalidData: "Ungültige Angaben",
    invalidCode: "Ungültiger Code",
    startFailed: "Die Zahlung konnte nicht gestartet werden. Versuchen Sie es erneut.",
    couponFailed: "Der Code konnte nicht geprüft werden.",
    checkoutNotLive: "Diese Bezahlung ist noch nicht freigegeben. Wenden Sie sich an den Verkäufer.",
    coupon: {
      notFound: "Code nicht gefunden",
      inactive: "Dieser Code ist nicht mehr aktiv",
      expired: "Dieser Code ist abgelaufen",
      maxRedemptions: "Dieser Code hat sein Nutzungslimit erreicht",
      wrongProduct: "Dieser Code gilt nicht für dieses Produkt",
      wrongCurrency: "Dieser Code gilt nicht für diese Währung",
      belowMinimum: "Der Bestellwert liegt unter dem Mindestwert des Codes",
      alreadyUsed: "Sie haben diesen Code bereits verwendet",
      noDiscount: "Dieser Code ergibt bei dieser Bestellung keinen Rabatt",
      zeroesTotal: "Der Rabatt darf die Bestellung nicht auf null senken",
    },
  },

  result: {
    title: "Zahlung",
    paid: {
      title: "Zahlung bestätigt!",
      body: "Wir haben Ihre Zugangsdaten für {product} per E-Mail geschickt.",
    },
    failed: {
      title: "Zahlung nicht bestätigt",
      body: "Es wurde nichts abgebucht. Sie können es mit einer anderen Zahlungsart erneut versuchen.",
    },
    pending: {
      title: "Wir bestätigen Ihre Zahlung",
      body: "Das dauert meist einige Sekunden. Diese Seite aktualisiert sich selbst.",
    },
    alsoBought: "Ebenfalls in Ihrer Bestellung",
    access: "Jetzt zugreifen",
    accessHint: "Melden Sie sich mit der E-Mail-Adresse an, die Sie für diesen Kauf verwendet haben.",
    watching: "Warten auf die Bestätigung des Zahlungsdienstleisters…",
  },
};

export default de;
