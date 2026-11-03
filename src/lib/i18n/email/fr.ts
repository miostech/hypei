import type { EmailDictionary } from "./pt";

const fr: EmailDictionary = {
  localeTag: "fr",

  greeting: "Bonjour",
  fallbackPurchaseProduct: "votre commande",
  fallbackRefundProduct: "votre achat",

  footer: {
    soldBy: "Cet achat a été effectué auprès de {seller}.",
    support: "Des questions ? Répondez à cet e-mail ou écrivez à {email}.",
    processedBy: "Paiement traité par Kabrun.",
  },

  purchaseConfirmed: {
    subject: "Achat confirmé : {product}",
    preheader: "Votre paiement de {amount} a été confirmé.",
    heading: "Paiement confirmé",
    introWithAccess: "{name}, nous avons reçu votre paiement et votre accès est déjà ouvert.",
    introWithoutAccess: "{name}, nous avons reçu votre paiement. {seller} vous contactera pour la suite.",
    rowProduct: "Produit",
    rowAmount: "Montant",
    rowOrder: "Commande",
    cta: "Accéder au contenu",
    note: "Connectez-vous avec l'adresse e-mail utilisée pour cet achat.",
  },

  refundCompleted: {
    subject: "Remboursement de {amount}",
    preheader: "Votre remboursement de {amount} a été traité.",
    heading: "Remboursement traité",
    intro: "{name}, le remboursement de votre achat a été traité.",
    rowProduct: "Produit",
    rowAmount: "Montant remboursé",
    note: "Le délai d'apparition du montant sur votre relevé dépend de votre banque ou du réseau de votre carte, en général jusqu'à deux cycles de facturation.",
  },
};

export default fr;
