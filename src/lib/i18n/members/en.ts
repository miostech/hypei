import type { MembersDictionary } from "./pt";

const en: MembersDictionary = {
  localeTag: "en",

  area: "Members area",

  home: {
    title: "Your products",
    subtitle: "Everything you've bought lives here.",
    emptyTitle: "Nothing published yet",
    emptyBody: "As soon as the producer publishes content, it shows up here.",
    locked: "No access",
    lockedHint: "Buy this product to unlock access.",
    preview: "Preview",
    open: "Open",
    resume: "Continue",
    start: "Start",
  },

  course: {
    title: "Content",
    teamPreview: "Team preview",
    outlineSummary: "{modules} module(s) · {lessons} lesson(s)",
    progress: "{completed} of {total} lessons completed",
    progressShort: "{completed}/{total} completed",
    resume: "Pick up where I left off",
    start: "Start the course",
    unpublished: "The content of this course is still being published.",
    outline: "Course content",
    minutesShort: "min",
  },

  lesson: {
    title: "Lesson",
    previous: "Previous",
    next: "Next",
    complete: "Complete and continue",
    uncomplete: "Mark as not completed",
    empty: "This lesson has no content yet.",
    unpublished: "The material for this lesson hasn't been published yet.",
    player: "Lesson player",
    openLive: "Join the stream",
    download: "Download material",
    openMaterial: "Open material",
    liveHint: "The session happens at the link below.",
    downloadHint: "The download link expires: save the file to your device.",
    externalHint: "The material for this lesson is hosted outside the platform.",
  },

  nav: {
    back: "Back",
    account: "Your account",
    myAccount: "My account",
    signOut: "Sign out",
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

export default en;
