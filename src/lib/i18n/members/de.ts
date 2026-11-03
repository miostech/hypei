import type { MembersDictionary } from "./pt";

/** Siezen, como no checkout. */
const de: MembersDictionary = {
  localeTag: "de",

  area: "Mitgliederbereich",

  home: {
    title: "Ihre Produkte",
    subtitle: "Alles, was Sie gekauft haben, finden Sie hier.",
    emptyTitle: "Noch nichts veröffentlicht",
    emptyBody: "Sobald der Verkäufer Inhalte veröffentlicht, erscheinen sie hier.",
    locked: "Kein Zugang",
    lockedHint: "Kaufen Sie dieses Produkt, um den Zugang freizuschalten.",
    preview: "Vorschau",
    open: "Öffnen",
    resume: "Fortsetzen",
    start: "Starten",
  },

  course: {
    title: "Inhalt",
    teamPreview: "Team-Vorschau",
    outlineSummary: "{modules} Modul(e) · {lessons} Lektion(en)",
    progress: "{completed} von {total} Lektionen abgeschlossen",
    progressShort: "{completed}/{total} abgeschlossen",
    resume: "Dort weitermachen, wo ich aufgehört habe",
    start: "Kurs starten",
    unpublished: "Der Inhalt dieses Kurses wird noch veröffentlicht.",
    outline: "Kursinhalt",
    minutesShort: "Min.",
  },

  lesson: {
    title: "Lektion",
    previous: "Zurück",
    next: "Weiter",
    complete: "Abschließen und weiter",
    uncomplete: "Als nicht abgeschlossen markieren",
    empty: "Diese Lektion hat noch keinen Inhalt.",
    unpublished: "Das Material dieser Lektion wurde noch nicht veröffentlicht.",
    player: "Player der Lektion",
    openLive: "Der Übertragung beitreten",
    download: "Material herunterladen",
    openMaterial: "Material öffnen",
    liveHint: "Die Sitzung findet über den Link unten statt.",
    downloadHint: "Der Download-Link läuft ab: Speichern Sie die Datei auf Ihrem Gerät.",
    externalHint: "Das Material dieser Lektion liegt außerhalb der Plattform.",
  },

  nav: {
    back: "Zurück",
    account: "Ihr Konto",
    myAccount: "Mein Konto",
    signOut: "Abmelden",
  },

  lessonTypes: {
    VIDEO: "Video",
    TEXT: "Text",
    PDF: "PDF",
    AUDIO: "Audio",
    LIVE: "Live",
    DOWNLOAD: "Download",
  },
};

export default de;
