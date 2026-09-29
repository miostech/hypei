import { LocalStorageProvider } from "./local-storage-provider";
import { S3StorageProvider } from "./s3-storage-provider";
import { NoopStorageProvider, resolveStorageConfig, type StorageProvider } from "./storage-provider";

export * from "./storage-provider";
export { LocalStorageProvider } from "./local-storage-provider";
export { S3StorageProvider } from "./s3-storage-provider";

/**
 * `local` keeps files on disk with signed URLs (development); `s3`, `r2` and `minio`
 * talk to real object storage; anything else disables uploads.
 */
export interface StorageEnv {
  STORAGE_PROVIDER: string;
  STORAGE_LOCAL_DIR?: string;
  STORAGE_BUCKET?: string;
  STORAGE_REGION?: string;
  STORAGE_ENDPOINT?: string;
  STORAGE_ACCESS_KEY_ID?: string;
  STORAGE_SECRET_ACCESS_KEY?: string;
  APP_URL?: string;
  DATA_HASH_SECRET?: string;
  SESSION_SECRET?: string;
}

export function createStorageProvider(env: StorageEnv): StorageProvider {
  if (env.STORAGE_PROVIDER === "local") {
    return new LocalStorageProvider({
      directory: env.STORAGE_LOCAL_DIR || ".storage",
      appUrl: env.APP_URL || "http://localhost:3100",
      secret: env.DATA_HASH_SECRET || env.SESSION_SECRET || "insecure-local-storage-secret",
    });
  }

  const config = resolveStorageConfig(env);
  if (!config) return new NoopStorageProvider();
  if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) {
    throw new Error(`STORAGE_PROVIDER=${config.provider} requires bucket and credentials`);
  }
  return new S3StorageProvider(config);
}
