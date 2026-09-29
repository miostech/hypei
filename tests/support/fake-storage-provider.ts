import type { StorageProvider, UploadTarget } from "@/lib/providers/storage";

/** Keeps uploads in memory so tests can assert what would have been stored. */
export class FakeStorageProvider implements StorageProvider {
  readonly name = "fake";
  readonly uploads: { key: string; contentType: string }[] = [];
  readonly deleted: string[] = [];

  async createUpload({ key, contentType }: { key: string; contentType: string }): Promise<UploadTarget> {
    this.uploads.push({ key, contentType });
    return {
      url: `https://storage.test/upload/${encodeURIComponent(key)}`,
      method: "PUT",
      headers: { "Content-Type": contentType },
      key,
      expiresInSeconds: 900,
    };
  }

  async getDownloadUrl({ key, downloadName }: { key: string; downloadName?: string }) {
    const suffix = downloadName ? `?download=${encodeURIComponent(downloadName)}` : "";
    return `https://storage.test/object/${encodeURIComponent(key)}${suffix}`;
  }

  async deleteObject(key: string) {
    this.deleted.push(key);
  }
}
