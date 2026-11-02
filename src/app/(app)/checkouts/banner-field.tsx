"use client";

import { ImageIcon, Loader2Icon, UploadCloudIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadToStorage } from "@/lib/ui/upload";
import { requestBannerUpload } from "./actions";

/**
 * O banner só existe depois do checkout, porque a chave do objeto é derivada dele. Na tela de
 * criação o campo é só um aviso — prometer o upload e falhar seria pior do que dizer quando vem.
 */
export function BannerField({ checkoutId, defaultKey, previewUrl }: { checkoutId?: string; defaultKey: string; previewUrl: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [storageKey, setStorageKey] = useState(defaultKey);
  const [preview, setPreview] = useState(previewUrl);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!checkoutId) {
    return (
      <div className="space-y-1.5">
        <Label>Banner</Label>
        <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
          Crie o checkout primeiro. A imagem de capa fica disponível na tela de edição.
        </p>
      </div>
    );
  }

  async function handleFile(file: File) {
    setError(null);
    setProgress(0);
    try {
      const authorized = await requestBannerUpload({
        checkoutId: checkoutId!,
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
      toast.success("Imagem enviada. Salve para publicar.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Falha no envio");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="banner">Banner</Label>

      <input
        ref={inputRef}
        id="banner"
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
            Enviando… {progress}%
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="bg-brand-gradient h-full rounded-full transition-all" style={{ width: `${Math.max(progress, 3)}%` }} />
          </div>
        </div>
      ) : storageKey ? (
        <div className="space-y-2">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- URL assinada que expira; otimizar cacharia um link morto
            <img src={preview} alt="" className="aspect-[16/5] w-full rounded-xl border object-cover" />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => inputRef.current?.click()}>
              Trocar imagem
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remover banner"
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
            Enviar imagem
            <span className="block text-xs text-muted-foreground">JPG, PNG ou WebP até 4 MB · 16:5 fica melhor</span>
          </span>
        </button>
      )}

      {!storageKey && !preview && progress === null && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ImageIcon className="size-3.5" aria-hidden />
          Aparece no topo da página de pagamento.
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input type="hidden" name="bannerKey" value={storageKey} />
    </div>
  );
}
