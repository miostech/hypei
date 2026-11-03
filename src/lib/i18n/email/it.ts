import type { EmailDictionary } from "./pt";

const it: EmailDictionary = {
  localeTag: "it",

  greeting: "Ciao",
  fallbackPurchaseProduct: "il tuo ordine",
  fallbackRefundProduct: "il tuo acquisto",

  footer: {
    soldBy: "Questo acquisto è stato fatto con {seller}.",
    support: "Domande? Rispondi a questa e-mail o scrivi a {email}.",
    processedBy: "Pagamento elaborato da Kabrun.",
  },

  purchaseConfirmed: {
    subject: "Acquisto confermato: {product}",
    preheader: "Il tuo pagamento di {amount} è stato confermato.",
    heading: "Pagamento confermato",
    introWithAccess: "{name}, abbiamo ricevuto il tuo pagamento e il tuo accesso è già attivo.",
    introWithoutAccess: "{name}, abbiamo ricevuto il tuo pagamento. {seller} ti contatterà con i prossimi passi.",
    rowProduct: "Prodotto",
    rowAmount: "Importo",
    rowOrder: "Ordine",
    cta: "Vai al contenuto",
    note: "Accedi con la stessa e-mail che hai usato per questo acquisto.",
  },

  refundCompleted: {
    subject: "Rimborso di {amount}",
    preheader: "Il tuo rimborso di {amount} è stato elaborato.",
    heading: "Rimborso elaborato",
    intro: "{name}, il rimborso del tuo acquisto è stato elaborato.",
    rowProduct: "Prodotto",
    rowAmount: "Importo rimborsato",
    note: "Il tempo perché l'importo compaia sull'estratto conto dipende dalla banca o dal circuito della carta, di solito fino a due cicli di fatturazione.",
  },
};

export default it;
