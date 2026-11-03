import type { CheckoutDictionary } from "./pt";

/** Tu informal, como é o padrão do comércio eletrônico em italiano. */
const it: CheckoutDictionary = {
  localeTag: "it",

  page: {
    title: "{product} — Pagamento",
    titleFallback: "Pagamento",
  },

  notLive: {
    title: "Pagamento non ancora attivo",
    body: "{seller} sta ancora completando la verifica del conto di incasso. Fino ad allora non viene addebitato nulla.",
    support: "Domande: {email}.",
  },

  form: {
    title: "I tuoi dati",
    name: "Nome completo",
    namePlaceholder: "Come sul documento",
    email: "E-mail",
    emailPlaceholder: "tu@email.com",
    emailHint: "È a questo indirizzo che invieremo l'accesso.",
    phone: "Telefono",
    country: "Paese",
    submit: "Vai al pagamento · {amount}",
  },

  coupon: {
    label: "Codice sconto",
    placeholder: "Hai un codice?",
    apply: "Applica",
    remove: "Rimuovi",
    applied: "Codice {code} applicato",
    line: "Codice {code}",
  },

  payment: {
    title: "Pagamento",
    pay: "Paga {amount}",
    methods: "Metodi di pagamento disponibili: {methods}.",
    failed: "Non è stato possibile completare il pagamento.",
  },

  bump: {
    title: "Aggiungi all'ordine",
    add: "Aggiungi",
    added: "Aggiunto",
    hint: "Entra nello stesso ordine, con lo stesso pagamento.",
  },

  summary: {
    title: "Riepilogo dell'ordine",
    subtotal: "Subtotale",
    total: "Totale",
  },

  trust: {
    secure: "Pagamento elaborato in sicurezza",
    guarantee: "Garanzia di {days} giorni",
    emailAccess: "Accesso inviato per e-mail",
  },

  soldBy: "Venduto da {seller}",
  processedBy: "Pagamento elaborato da {brand}",

  methodNames: {
    CREDIT_CARD: "Carta di credito",
    DEBIT_CARD: "Carta di debito",
    PIX: "Pix",
    BOLETO: "Boleto",
    SEPA_DEBIT: "Addebito SEPA",
    BANK_TRANSFER: "Bonifico bancario",
    APPLE_PAY: "Apple Pay",
    GOOGLE_PAY: "Google Pay",
    PAYPAL: "PayPal",
  },

  errors: {
    rateLimited: "Troppi tentativi. Attendi un momento e riprova.",
    invalidName: "Inserisci il tuo nome",
    invalidEmail: "Indirizzo e-mail non valido",
    invalidData: "Dati non validi",
    invalidCode: "Codice non valido",
    startFailed: "Non è stato possibile avviare il pagamento. Riprova.",
    couponFailed: "Non è stato possibile verificare il codice.",
    checkoutNotLive: "Questo pagamento non è ancora attivo. Contatta chi vende.",
    coupon: {
      notFound: "Codice non trovato",
      inactive: "Questo codice non è più attivo",
      expired: "Questo codice è scaduto",
      maxRedemptions: "Questo codice ha raggiunto il limite di utilizzi",
      wrongProduct: "Questo codice non vale per questo prodotto",
      wrongCurrency: "Questo codice non vale per questa valuta",
      belowMinimum: "L'importo dell'ordine è inferiore al minimo del codice",
      alreadyUsed: "Hai già usato questo codice",
      noDiscount: "Questo codice non genera sconto su questo ordine",
      zeroesTotal: "Lo sconto non può azzerare l'ordine",
    },
  },

  result: {
    title: "Pagamento",
    paid: {
      title: "Pagamento confermato!",
      body: "Abbiamo inviato i dati di accesso a {product} alla tua e-mail.",
    },
    failed: {
      title: "Pagamento non approvato",
      body: "Non è stato addebitato nulla. Puoi riprovare con un altro metodo di pagamento.",
    },
    pending: {
      title: "Stiamo confermando il tuo pagamento",
      body: "In genere ci vogliono pochi secondi. Questa pagina si aggiorna da sola.",
    },
    alsoBought: "Anche nel tuo ordine",
    access: "Accedi ora",
    accessHint: "Accedi con la stessa e-mail che hai usato per questo acquisto.",
    watching: "In attesa della conferma del fornitore di pagamento…",
  },
};

export default it;
