import type { MembersDictionary } from "./pt";

/** Vouvoiement, como no checkout. */
const fr: MembersDictionary = {
  localeTag: "fr",

  area: "Espace membres",

  home: {
    title: "Vos produits",
    subtitle: "Tout ce que vous avez acheté se trouve ici.",
    emptyTitle: "Aucun contenu publié pour l'instant",
    emptyBody: "Dès que le vendeur publiera du contenu, il apparaîtra ici.",
    locked: "Pas d'accès",
    lockedHint: "Achetez ce produit pour débloquer l'accès.",
    preview: "Aperçu",
    open: "Ouvrir",
    resume: "Continuer",
    start: "Commencer",
  },

  course: {
    title: "Contenu",
    teamPreview: "Aperçu de l'équipe",
    outlineSummary: "{modules} module(s) · {lessons} leçon(s)",
    progress: "{completed} leçon(s) terminée(s) sur {total}",
    progressShort: "{completed}/{total} terminées",
    resume: "Reprendre où je m'étais arrêté",
    start: "Commencer le cours",
    unpublished: "Le contenu de ce cours est encore en cours de publication.",
    outline: "Contenu du cours",
    minutesShort: "min",
  },

  lesson: {
    title: "Leçon",
    previous: "Précédente",
    next: "Suivante",
    complete: "Terminer et continuer",
    uncomplete: "Marquer comme non terminée",
    empty: "Cette leçon n'a pas encore de contenu.",
    unpublished: "Le matériel de cette leçon n'a pas encore été publié.",
    player: "Lecteur de la leçon",
    openLive: "Rejoindre la diffusion",
    download: "Télécharger le matériel",
    openMaterial: "Ouvrir le matériel",
    liveHint: "La séance a lieu sur le lien ci-dessous.",
    downloadHint: "Le lien de téléchargement expire : enregistrez le fichier sur votre appareil.",
    externalHint: "Le matériel de cette leçon est hébergé en dehors de la plateforme.",
  },

  nav: {
    back: "Retour",
    account: "Votre compte",
    myAccount: "Mon compte",
    signOut: "Se déconnecter",
  },

  lessonTypes: {
    VIDEO: "Vidéo",
    TEXT: "Texte",
    PDF: "PDF",
    AUDIO: "Audio",
    LIVE: "En direct",
    DOWNLOAD: "Téléchargement",
  },
};

export default fr;
