import type { MembersDictionary } from "./pt";

/** Tu informal, como no checkout. */
const it: MembersDictionary = {
  localeTag: "it",

  area: "Area membri",

  home: {
    title: "I tuoi prodotti",
    subtitle: "Tutto quello che hai acquistato è qui.",
    emptyTitle: "Ancora nessun contenuto pubblicato",
    emptyBody: "Appena il venditore pubblicherà dei contenuti, compariranno qui.",
    locked: "Nessun accesso",
    lockedHint: "Acquista questo prodotto per sbloccare l'accesso.",
    preview: "Anteprima",
    open: "Apri",
    resume: "Continua",
    start: "Inizia",
  },

  student: {
    title: "Area dello studente",
    subtitle: "Tutto quello che hai acquistato, da tutti i venditori.",
    emptyTitle: "Non hai ancora acquistato niente",
    emptyBody: "Quello che acquisti compare qui, pronto da guardare.",
    producerPanel: "Area del venditore",
  },

  course: {
    title: "Contenuto",
    teamPreview: "Anteprima del team",
    outlineSummary: "{modules} modulo/i · {lessons} lezione/i",
    progress: "{completed} di {total} lezioni completate",
    progressShort: "{completed}/{total} completate",
    resume: "Riprendi da dove ho lasciato",
    start: "Inizia il corso",
    unpublished: "Il contenuto di questo corso è ancora in pubblicazione.",
    outline: "Contenuto del corso",
    minutesShort: "min",
  },

  lesson: {
    title: "Lezione",
    previous: "Precedente",
    next: "Successiva",
    complete: "Completa e continua",
    uncomplete: "Segna come non completata",
    empty: "Questa lezione non ha ancora contenuti.",
    unpublished: "Il materiale di questa lezione non è ancora stato pubblicato.",
    player: "Player della lezione",
    openLive: "Entra nella diretta",
    download: "Scarica il materiale",
    openMaterial: "Apri il materiale",
    liveHint: "L'incontro si svolge al link qui sotto.",
    downloadHint: "Il link per il download scade: salva il file sul tuo dispositivo.",
    externalHint: "Il materiale di questa lezione è ospitato fuori dalla piattaforma.",
  },

  nav: {
    back: "Indietro",
    account: "Il tuo account",
    myAccount: "Il mio account",
    signOut: "Esci",
  },

  lessonTypes: {
    VIDEO: "Video",
    TEXT: "Testo",
    PDF: "PDF",
    AUDIO: "Audio",
    LIVE: "In diretta",
    DOWNLOAD: "Download",
  },
};

export default it;
