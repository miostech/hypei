import type { MembersDictionary } from "./pt";

/** Tuteo, como no checkout. */
const es: MembersDictionary = {
  localeTag: "es",

  area: "Área de miembros",

  home: {
    title: "Tus productos",
    subtitle: "Todo lo que has comprado está aquí.",
    emptyTitle: "Todavía no hay contenido publicado",
    emptyBody: "En cuanto el productor publique contenido, aparecerá aquí.",
    locked: "Sin acceso",
    lockedHint: "Compra este producto para desbloquear el acceso.",
    preview: "Vista previa",
    open: "Abrir",
    resume: "Continuar",
    start: "Empezar",
  },

  course: {
    title: "Contenido",
    teamPreview: "Vista previa del equipo",
    outlineSummary: "{modules} módulo(s) · {lessons} clase(s)",
    progress: "{completed} de {total} clases completadas",
    progressShort: "{completed}/{total} completadas",
    resume: "Seguir donde lo dejé",
    start: "Empezar el curso",
    unpublished: "El contenido de este curso todavía se está publicando.",
    outline: "Contenido del curso",
    minutesShort: "min",
  },

  lesson: {
    title: "Clase",
    previous: "Anterior",
    next: "Siguiente",
    complete: "Completar y continuar",
    uncomplete: "Marcar como no completada",
    empty: "Esta clase todavía no tiene contenido.",
    unpublished: "El material de esta clase todavía no se ha publicado.",
    player: "Reproductor de la clase",
    openLive: "Entrar a la transmisión",
    download: "Descargar material",
    openMaterial: "Abrir material",
    liveHint: "El encuentro ocurre en el enlace de abajo.",
    downloadHint: "El enlace de descarga caduca: guarda el archivo en tu dispositivo.",
    externalHint: "El material de esta clase está alojado fuera de la plataforma.",
  },

  nav: {
    back: "Volver",
    account: "Tu cuenta",
    myAccount: "Mi cuenta",
    signOut: "Cerrar sesión",
  },

  lessonTypes: {
    VIDEO: "Vídeo",
    TEXT: "Texto",
    PDF: "PDF",
    AUDIO: "Audio",
    LIVE: "En directo",
    DOWNLOAD: "Descarga",
  },
};

export default es;
