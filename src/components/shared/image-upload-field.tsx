"use client";

import { Loader2Icon, UploadCloudIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { IMAGE_MAX_BYTES } from "@/lib/images";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import { fill } from "@/lib/i18n/locale";
import { uploadToStorage } from "@/lib/ui/upload";

export interface ImageUploadRequest {
  ownerId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export type ImageUploadResult =
  | { ok: true; url: string; key: string; headers: Record<string, string> }
  | { ok: false; message: string };

/**
 * Campo de imagem enviada pelo produtor: capa do produto, banner e logo do checkout.
 *
 * O dono (produto ou checkout) precisa existir, porque a chave do objeto é derivada dele. Na
 * tela de criação o campo vira aviso em vez de botão — prometer o upload ali e falhar na hora
 * seria pior do que dizer quando ele aparece.
 */
export function ImageUploadField({
  name,
  label,
  hint,
  pendingNote,
  previewClass,
  ownerId,
  defaultKey,
  previewUrl,
  requestUpload,
}: {
  name: string;
  label: string;
  hint: string;
  pendingNote: string;
  previewClass: string;
  ownerId?: string;
  defaultKey: string;
  previewUrl: string | null;
  requestUpload: (input: ImageUploadRequest) => Promise<ImageUploadResult>;
}) {
  const dict = useAppDictionary();
  const t = dict.upload;
  const inputRef = useRef<HTMLInputElement>(null);
  const [storageKey, setStorageKey] = useState(defaultKey);
  const [preview, setPreview] = useState(previewUrl);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!ownerId) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">{pendingNote}</p>
      </div>
    );
  }

  async function handleFile(file: File) {
    setError(null);
    setProgress(0);
    try {
      const authorized = await requestUpload({
        ownerId: ownerId!,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      if (!authorized.ok) {
        setError(authorized.message);
        setProgress(null);
        return;
      }

      await uploadToStorage(authorized.url, authorized.headers, file, setProgress);
      setStorageKey(authorized.key);
      // A URL assinada só existe depois de salvar; até lá o próprio arquivo serve de prévia.
      setPreview(URL.createObjectURL(file));
      toast.success(t.sent);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t.failed);
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`image-${name}`}>{label}</Label>

      <input
        ref={inputRef}
        id={`image-${name}`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {progress !== null ? (
        <div className="space-y-2 rounded-xl border p-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            {fill(t.uploading, { percent: progress })}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="bg-brand-gradient h-full rounded-full transition-all" style={{ width: `${Math.max(progress, 3)}%` }} />
          </div>
        </div>
      ) : storageKey ? (
        <div className="space-y-2">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- URL assinada que expira; otimizar cacharia um link morto
            <img src={preview} alt="" className={`rounded-xl border object-cover ${previewClass}`} />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => inputRef.current?.click()}>
              {t.replace}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={fill(t.remove, { label })}
              onClick={() => {
                setStorageKey("");
                setPreview(null);
              }}
            >
              <XIcon />
            </Button>
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
            {t.pick}
            <span className="block text-xs text-muted-foreground">
              {fill(t.limits, { mb: Math.round(IMAGE_MAX_BYTES / 1_000_000), hint })}
            </span>
          </span>
        </button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input type="hidden" name={name} value={storageKey} />
    </div>
  );
}
