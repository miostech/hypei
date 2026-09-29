"use client";

import { FileIcon, Loader2Icon, UploadCloudIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { LessonType } from "@/generated/prisma/enums";
import { requestLessonUpload } from "./actions";

export interface UploadedFile {
  key: string;
  filename: string;
  contentType: string;
  bytes: number;
}

const ACCEPT: Partial<Record<LessonType, string>> = {
  VIDEO: "video/*",
  AUDIO: "audio/*",
  PDF: "application/pdf",
  DOWNLOAD: "*/*",
};

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/**
 * Sends the file straight to storage with the signed URL the server hands out,
 * so a 2 GB video never passes through the app. XMLHttpRequest instead of fetch
 * because it is the only one that reports upload progress.
 */
function upload(url: string, headers: Record<string, string>, file: File, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () =>
      request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Upload falhou (${request.status})`)),
    );
    request.addEventListener("error", () => reject(new Error("Falha de rede durante o envio")));
    request.addEventListener("abort", () => reject(new Error("Envio cancelado")));
    request.send(file);
  });
}

export function LessonFileField({
  moduleId,
  type,
  value,
  onChange,
  fieldId,
}: {
  moduleId: string;
  type: LessonType;
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  fieldId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setProgress(0);
    try {
      const authorized = await requestLessonUpload({
        moduleId,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        type,
      });
      if (!authorized.ok) {
        setError(authorized.message);
        setProgress(null);
        return;
      }

      await upload(authorized.url, authorized.headers, file, setProgress);
      onChange({ key: authorized.key, filename: file.name, contentType: file.type || "application/octet-stream", bytes: file.size });
      toast.success("Arquivo enviado");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Falha no envio");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`file-${fieldId}`}>Arquivo da aula</Label>

      <input
        ref={inputRef}
        id={`file-${fieldId}`}
        type="file"
        accept={ACCEPT[type] ?? "*/*"}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
          <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.filename}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(value.bytes)} · enviado</p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover arquivo" onClick={() => onChange(null)}>
            <XIcon />
          </Button>
        </div>
      ) : progress !== null ? (
        <div className="space-y-2 rounded-xl border p-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Enviando… {progress}%
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="bg-brand-gradient h-full rounded-full transition-all" style={{ width: `${Math.max(progress, 3)}%` }} />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed p-3 text-left transition-colors hover:bg-muted/60"
        >
          <UploadCloudIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-sm">
            Escolher arquivo
            <span className="block text-xs text-muted-foreground">
              {type === "VIDEO" ? "Vídeo até 2 GB" : type === "AUDIO" ? "Áudio até 300 MB" : type === "PDF" ? "PDF até 100 MB" : "Até 300 MB"}
            </span>
          </span>
        </button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {value && (
        <>
          <input type="hidden" name="storageKey" value={value.key} />
          <input type="hidden" name="storageFilename" value={value.filename} />
          <input type="hidden" name="storageType" value={value.contentType} />
          <input type="hidden" name="storageBytes" value={String(value.bytes)} />
        </>
      )}
    </div>
  );
}
