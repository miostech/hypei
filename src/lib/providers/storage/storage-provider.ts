/**
 * S3-compatible storage abstraction (AWS S3, Cloudflare R2, MinIO share the same API).
 * Lesson media, thumbnails and downloads go here; the database only stores the object key.
 *
 * Uploads never pass through the app server: the browser receives a short-lived signed
 * URL and sends the bytes straight to storage.
 */
import { logger } from "@/lib/logger";

export interface UploadTarget {
  /** Where the browser sends the file. */
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  key: string;
  expiresInSeconds: number;
}

export interface StorageProvider {
  readonly name: string;
  createUpload(input: { key: string; contentType: string; expiresInSeconds?: number }): Promise<UploadTarget>;
  /** Short-lived read URL. Media is never public: every playback signs a fresh URL. */
  getDownloadUrl(input: { key: string; expiresInSeconds?: number; downloadName?: string }): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

export interface S3CompatibleConfig {
  provider: "s3" | "r2" | "minio";
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** MinIO needs path-style URLs. */
  forcePathStyle: boolean;
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Storage is not configured (STORAGE_PROVIDER=none)");
  }
}

export class NoopStorageProvider implements StorageProvider {
  readonly name = "none";
  createUpload(): Promise<UploadTarget> {
    throw new StorageNotConfiguredError();
  }
  getDownloadUrl(): Promise<string> {
    throw new StorageNotConfiguredError();
  }
  deleteObject(): Promise<void> {
    throw new StorageNotConfiguredError();
  }
}

export function resolveStorageConfig(env: {
  STORAGE_PROVIDER?: string;
  STORAGE_BUCKET?: string;
  STORAGE_REGION?: string;
  STORAGE_ENDPOINT?: string;
  STORAGE_ACCESS_KEY_ID?: string;
  STORAGE_SECRET_ACCESS_KEY?: string;
}): S3CompatibleConfig | null {
  const provider = env.STORAGE_PROVIDER;
  if (provider !== "s3" && provider !== "r2" && provider !== "minio") return null;
  return {
    provider,
    bucket: env.STORAGE_BUCKET ?? "",
    region: env.STORAGE_REGION || (provider === "r2" ? "auto" : "us-east-1"),
    endpoint: env.STORAGE_ENDPOINT || undefined,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID ?? "",
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY ?? "",
    forcePathStyle: provider === "minio",
  };
}

function extensionOf(filename: string): string {
  return filename.includes(".") ? `.${filename.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "";
}

/** O que o objeto pertence: aula de curso, arte de checkout ou capa de produto. */
export type AssetScope = "courses" | "checkouts" | "products";

/**
 * Chave sem colisão que também se lê bem numa listagem do bucket. O nome original do arquivo
 * não entra: ele vem do computador do produtor e traria acento, espaço e barra para dentro da
 * chave. Só a extensão sobrevive, normalizada.
 */
export function buildAssetKey(parts: { organizationId: string; scope: AssetScope; scopeId: string; filename: string; id: string }): string {
  return `organizations/${parts.organizationId}/${parts.scope}/${parts.scopeId}/${parts.id}${extensionOf(parts.filename)}`;
}

/**
 * Assina uma imagem do produtor para exibição, e devolve null se não der.
 *
 * Engole a falha de propósito. Banner, logo e capa são decoração: na página de pagamento,
 * trocar a venda inteira por um erro 500 porque a capa não assinou é o pior resultado
 * possível. Quem renderiza trata o null — ou esconde a imagem, ou mostra as iniciais.
 */
export async function signImage(storage: StorageProvider, key: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    return await storage.getDownloadUrl({ key });
  } catch (error) {
    logger.warn({ err: error, key }, "could not sign producer image");
    return null;
  }
}
