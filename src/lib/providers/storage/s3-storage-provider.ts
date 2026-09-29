import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { S3CompatibleConfig, StorageProvider, UploadTarget } from "./storage-provider";

const UPLOAD_TTL = 15 * 60;
const DOWNLOAD_TTL = 60 * 60;

/** Works with AWS S3, Cloudflare R2 and MinIO — they share the same signing protocol. */
export class S3StorageProvider implements StorageProvider {
  readonly name: string;
  private readonly client: S3Client;

  constructor(private readonly config: S3CompatibleConfig) {
    this.name = config.provider;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async createUpload({ key, contentType, expiresInSeconds = UPLOAD_TTL }: { key: string; contentType: string; expiresInSeconds?: number }): Promise<UploadTarget> {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.config.bucket, Key: key, ContentType: contentType }),
      { expiresIn: expiresInSeconds },
    );
    return { url, method: "PUT", headers: { "Content-Type": contentType }, key, expiresInSeconds };
  }

  getDownloadUrl({ key, expiresInSeconds = DOWNLOAD_TTL, downloadName }: { key: string; expiresInSeconds?: number; downloadName?: string }) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ResponseContentDisposition: downloadName ? `attachment; filename="${downloadName.replace(/"/g, "")}"` : undefined,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }
}
