import type { LocaleTag } from "../locale";

/**
 * Dicionário do aluno, em português. Mesma regra do checkout: esta é a fonte da forma, e os
 * outros idiomas são tipados contra `MembersDictionary`.
 *
 * Quem lê isto é quem comprou — nunca o produtor. O painel dele segue em pt-BR.
 */
const pt = {
  localeTag: "pt-BR" as LocaleTag,

  area: "Área de membros",

  home: {
    title: "Seus produtos",
    subtitle: "Tudo que você comprou fica disponível aqui.",
    emptyTitle: "Nenhum conteúdo publicado",
    emptyBody: "Assim que o produtor publicar um conteúdo, ele aparece aqui.",
    locked: "Sem acesso",
    lockedHint: "Compre este produto para liberar o acesso.",
    preview: "Prévia",
    open: "Acessar",
    resume: "Continuar",
    start: "Começar",
  },

  course: {
    title: "Conteúdo",
    teamPreview: "Prévia da equipe",
    outlineSummary: "{modules} módulo(s) · {lessons} aula(s)",
    progress: "{completed} de {total} aulas concluídas",
    progressShort: "{completed}/{total} concluídas",
    resume: "Continuar de onde parei",
    start: "Começar o curso",
    unpublished: "O conteúdo deste curso ainda está sendo publicado.",
    outline: "Conteúdo do curso",
    /** Abreviação de minutos ao lado da duração da aula. */
    minutesShort: "min",
  },

  lesson: {
    title: "Aula",
    previous: "Anterior",
    next: "Próxima",
    complete: "Concluir e avançar",
    uncomplete: "Marcar como não concluída",
    empty: "Esta aula ainda não tem conteúdo.",
    unpublished: "O material desta aula ainda não foi publicado.",
    player: "Player da aula",
    openLive: "Entrar na transmissão",
    download: "Baixar material",
    openMaterial: "Abrir material",
    liveHint: "O encontro acontece no link abaixo.",
    downloadHint: "O link de download expira: salve o arquivo no seu dispositivo.",
    externalHint: "O material desta aula está hospedado fora da plataforma.",
  },

  nav: {
    back: "Voltar",
    account: "Sua conta",
    myAccount: "Minha conta",
    signOut: "Sair",
  },

  /** Os mesmos tipos de `membersArea.lessonTypes`, no dicionário do app do produtor. */
  lessonTypes: {
    VIDEO: "Vídeo",
    TEXT: "Texto",
    PDF: "PDF",
    AUDIO: "Áudio",
    LIVE: "Ao vivo",
    DOWNLOAD: "Download",
  },
};

export type MembersDictionary = typeof pt;

export default pt;
