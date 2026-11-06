import { DownloadIcon, ExternalLinkIcon, RadioIcon } from "lucide-react";
import type { LessonType } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import type { MembersDictionary } from "@/lib/i18n/members";

/**
 * Producer-provided links are untrusted input: only http(s) survives, and only a short
 * allowlist of hosts is ever embedded in an iframe. Anything else becomes a plain link.
 */
function safeUrl(raw: string | null): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function embedUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  }
  if (host === "vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host === "player.vimeo.com" || host === "youtube-nocookie.com") return url.toString();
  return null;
}

const VIDEO_FILE = /\.(mp4|webm|ogg|mov|m3u8)$/i;
const AUDIO_FILE = /\.(mp3|wav|ogg|m4a|aac)$/i;

export function LessonMedia({
  type,
  externalUrl,
  content,
  mediaType,
  dict,
}: {
  type: LessonType;
  externalUrl: string | null;
  content: string | null;
  /** MIME type of an uploaded file, when the lesson has one. */
  mediaType?: string | null;
  dict: MembersDictionary;
}) {
  if (type === "TEXT") {
    return (
      <article className="rounded-xl border bg-card p-6 text-sm leading-relaxed whitespace-pre-wrap shadow-soft sm:p-8">
        {content || dict.lesson.empty}
      </article>
    );
  }

  const url = safeUrl(externalUrl);
  if (!url) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        {dict.lesson.unpublished}
      </div>
    );
  }

  const embed = embedUrl(url);
  if (type === "VIDEO" && embed) {
    return (
      <div className="aspect-video overflow-hidden rounded-xl border bg-black shadow-soft">
        <iframe
          src={embed}
          title={dict.lesson.player}
          className="size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // An uploaded file is identified by its MIME type; a link, by its extension.
  const uploadedVideo = mediaType?.startsWith("video/") ?? false;
  const uploadedAudio = mediaType?.startsWith("audio/") ?? false;

  if (type === "VIDEO" && (uploadedVideo || VIDEO_FILE.test(url.pathname))) {
    return (
      <video controls preload="metadata" src={url.toString()} className="aspect-video w-full rounded-xl border bg-black shadow-soft" />
    );
  }

  if (type === "AUDIO" && (uploadedAudio || AUDIO_FILE.test(url.pathname))) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-soft">
        <audio controls preload="metadata" src={url.toString()} className="w-full" />
      </div>
    );
  }

  // Mesma regra do serviço: PDF e Download viram anexo com o nome do arquivo original.
  const download = type === "DOWNLOAD" || type === "PDF";
  const label = type === "LIVE" ? dict.lesson.openLive : download ? dict.lesson.download : dict.lesson.openMaterial;
  const Icon = type === "LIVE" ? RadioIcon : download ? DownloadIcon : ExternalLinkIcon;
  // `mediaType` só existe em arquivo enviado pelo produtor; link de terceiro não tem.
  const hint =
    type === "LIVE"
      ? dict.lesson.liveHint
      : mediaType
        ? dict.lesson.downloadHint
        : dict.lesson.externalHint;

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-10 text-center shadow-soft">
      <span className="bg-brand-gradient flex size-12 items-center justify-center rounded-2xl text-white">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="text-sm text-muted-foreground">{hint}</p>
      <Button render={<a href={url.toString()} target="_blank" rel="noopener noreferrer" />}>
        <Icon />
        {label}
      </Button>
    </div>
  );
}
