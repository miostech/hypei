/**
 * S3-compatible storage abstraction (AWS S3, Cloudflare R2, MinIO share the same API).
 * Lesson media, thumbnails and downloads go here; the database only stores the object key.
 *
 * Uploads never pass through the app server: the browser receives a short-lived signed
 * URL and sends the bytes straight to storage.
 */
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

/** Builds a collision-free object key that also reads well in a bucket listing. */
export function buildStorageKey(parts: { organizationId: string; courseId: string; filename: string; id: string }): string {
  const extension = parts.filename.includes(".") ? `.${parts.filename.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "";
  return `organizations/${parts.organizationId}/courses/${parts.courseId}/${parts.id}${extension}`;
}
