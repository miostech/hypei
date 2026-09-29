import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider, UploadTarget } from "./storage-provider";

const UPLOAD_TTL = 15 * 60;
const DOWNLOAD_TTL = 60 * 60;

export interface LocalStorageConfig {
  /** Directory the files land in (gitignored). */
  directory: string;
  /** Absolute base of the app, used to build the signed URLs. */
  appUrl: string;
  secret: string;
}

export interface SignedParams {
  key: string;
  exp: string;
  sig: string;
  contentType?: string;
}

/**
 * Filesystem-backed storage for local development: same contract as S3, including
 * short-lived signed URLs, so no code outside this file knows the difference.
 * The signature covers the key, the operation and the expiry, and files are always
 * resolved inside the base directory.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";

  constructor(private readonly config: LocalStorageConfig) {}

  private sign(operation: "put" | "get", key: string, exp: number): string {
    return createHmac("sha256", this.config.secret).update(`${operation}:${key}:${exp}`).digest("base64url");
  }

  /** Constant-time check of a signature produced by `sign`. */
  verify(operation: "put" | "get", params: SignedParams): boolean {
    const exp = Number(params.exp);
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
    const expected = Buffer.from(this.sign(operation, params.key, exp));
    const received = Buffer.from(params.sig);
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  /** Resolves a key inside the base directory, refusing traversal. */
  resolve(key: string): string {
    const base = path.resolve(this.config.directory);
    const target = path.resolve(base, key);
    if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return target;
  }

  async createUpload({ key, contentType, expiresInSeconds = UPLOAD_TTL }: { key: string; contentType: string; expiresInSeconds?: number }): Promise<UploadTarget> {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const url = new URL("/api/storage/upload", this.config.appUrl);
    url.searchParams.set("key", key);
    url.searchParams.set("exp", String(exp));
    url.searchParams.set("sig", this.sign("put", key, exp));
    return { url: url.toString(), method: "PUT", headers: { "Content-Type": contentType }, key, expiresInSeconds };
  }

  async getDownloadUrl({ key, expiresInSeconds = DOWNLOAD_TTL, downloadName }: { key: string; expiresInSeconds?: number; downloadName?: string }) {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const url = new URL("/api/storage/object", this.config.appUrl);
    url.searchParams.set("key", key);
    url.searchParams.set("exp", String(exp));
    url.searchParams.set("sig", this.sign("get", key, exp));
    if (downloadName) url.searchParams.set("name", downloadName);
    return url.toString();
  }

  async write(key: string, body: Buffer, contentType: string): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    await writeFile(`${target}.meta`, JSON.stringify({ contentType }), "utf8");
  }

  async read(key: string): Promise<{ body: Buffer; contentType: string; size: number }> {
    const target = this.resolve(key);
    const [body, info] = await Promise.all([readFile(target), stat(target)]);
    let contentType = "application/octet-stream";
    try {
      contentType = (JSON.parse(await readFile(`${target}.meta`, "utf8")) as { contentType: string }).contentType;
    } catch {
      // Metadata is best-effort: a missing sidecar just means the default type.
    }
    return { body, contentType, size: info.size };
  }

  async deleteObject(key: string): Promise<void> {
    const target = this.resolve(key);
    await rm(target, { force: true });
    await rm(`${target}.meta`, { force: true });
  }
}
