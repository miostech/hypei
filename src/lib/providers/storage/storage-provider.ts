/**
 * S3-compatible storage abstraction (AWS S3, Cloudflare R2, MinIO share the same API).
 * Lesson media, thumbnails and downloads go here; the database only stores the object key.
 */
export interface StorageProvider {
  readonly name: string;
  getUploadUrl(input: { key: string; contentType: string; expiresInSeconds?: number }): Promise<{ url: string; key: string }>;
  getDownloadUrl(input: { key: string; expiresInSeconds?: number }): Promise<string>;
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
  getUploadUrl(): Promise<{ url: string; key: string }> {
    throw new StorageNotConfiguredError();
  }
  getDownloadUrl(): Promise<string> {
    throw new StorageNotConfiguredError();
  }
  deleteObject(): Promise<void> {
    throw new StorageNotConfiguredError();
  }
}

export function resolveStorageConfig(env: NodeJS.ProcessEnv): S3CompatibleConfig | null {
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

/** Phase 1 ships without media uploads; the S3 client adapter lands with the member-area uploads (Phase 2). */
export function createStorageProvider(env: NodeJS.ProcessEnv): StorageProvider {
  const config = resolveStorageConfig(env);
  if (!config) return new NoopStorageProvider();
  throw new Error(`Storage adapter for "${config.provider}" is planned for Phase 2`);
}
