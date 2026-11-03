import type { CheckoutDictionary } from "./pt";

/** Vouvoiement, como é o padrão do comércio eletrônico em francês. */
const fr: CheckoutDictionary = {
  localeTag: "fr",

  page: {
    title: "{product} — Paiement",
    titleFallback: "Paiement",
  },

  notLive: {
    title: "Paiement pas encore activé",
    body: "{seller} est en train de finaliser la vérification de son compte de paiement. Aucun montant n'est prélevé d'ici là.",
    support: "Questions : {email}.",
  },

  form: {
    title: "Vos informations",
    name: "Nom complet",
    namePlaceholder: "Comme sur votre pièce d'identité",
    email: "E-mail",
    emailPlaceholder: "vous@email.com",
    emailHint: "C'est à cette adresse que nous enverrons votre accès.",
    phone: "Téléphone",
    country: "Pays",
    submit: "Passer au paiement · {amount}",
  },

  coupon: {
    label: "Code de réduction",
    placeholder: "Vous avez un code ?",
    apply: "Appliquer",
    remove: "Retirer",
    applied: "Code {code} appliqué",
    line: "Code {code}",
  },

  payment: {
    title: "Paiement",
    pay: "Payer {amount}",
    methods: "Moyens de paiement disponibles : {methods}.",
    failed: "Le paiement n'a pas pu être finalisé.",
  },

  bump: {
    title: "À ajouter à votre commande",
    add: "Ajouter",
    added: "Ajouté",
    hint: "S'ajoute à la même commande, dans le même paiement.",
  },

  summary: {
    title: "Récapitulatif de la commande",
    subtotal: "Sous-total",
    total: "Total",
  },

  trust: {
    secure: "Paiement traité en toute sécurité",
    guarantee: "Garantie de {days} jours",
    emailAccess: "Accès envoyé par e-mail",
  },

  soldBy: "Vendu par {seller}",
  processedBy: "Paiement traité par {brand}",

  methodNames: {
    CREDIT_CARD: "Carte de crédit",
    DEBIT_CARD: "Carte de débit",
    PIX: "Pix",
    BOLETO: "Boleto",
    SEPA_DEBIT: "Prélèvement SEPA",
    BANK_TRANSFER: "Virement bancaire",
    APPLE_PAY: "Apple Pay",
    GOOGLE_PAY: "Google Pay",
    PAYPAL: "PayPal",
  },

  errors: {
    rateLimited: "Trop de tentatives. Patientez un instant et réessayez.",
    invalidName: "Indiquez votre nom",
    invalidEmail: "Adresse e-mail invalide",
    invalidData: "Informations invalides",
    invalidCode: "Code invalide",
    startFailed: "Le paiement n'a pas pu être lancé. Réessayez.",
    couponFailed: "Le code n'a pas pu être validé.",
    checkoutNotLive: "Ce paiement n'est pas encore activé. Contactez le vendeur.",
    coupon: {
      notFound: "Code introuvable",
      inactive: "Ce code n'est plus actif",
      expired: "Ce code a expiré",
      maxRedemptions: "Ce code a atteint sa limite d'utilisations",
      wrongProduct: "Ce code ne s'applique pas à ce produit",
      wrongCurrency: "Ce code ne s'applique pas à cette devise",
      belowMinimum: "Le montant de la commande est inférieur au minimum du code",
      alreadyUsed: "Vous avez déjà utilisé ce code",
      noDiscount: "Ce code ne donne aucune réduction sur cette commande",
      zeroesTotal: "La réduction ne peut pas ramener la commande à zéro",
    },
  },

  result: {
    title: "Paiement",
    paid: {
      title: "Paiement confirmé !",
      body: "Nous avons envoyé vos accès à {product} par e-mail.",
    },
    failed: {
      title: "Paiement refusé",
      body: "Aucun montant n'a été prélevé. Vous pouvez réessayer avec un autre moyen de paiement.",
    },
    pending: {
      title: "Nous confirmons votre paiement",
      body: "Cela prend généralement quelques secondes. Cette page se met à jour toute seule.",
    },
    alsoBought: "Également dans votre commande",
    access: "Accéder maintenant",
    accessHint: "Connectez-vous avec l'adresse e-mail utilisée pour cet achat.",
    watching: "En attente de la confirmation du prestataire de paiement…",
  },
};

export default fr;
