import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { LocalStorageProvider } from "@/lib/providers/storage";
import { getServices } from "@/server/container";

/** Same ceiling as the largest lesson type; the service already checked the real one. */
const MAX_BYTES = 2_000_000_000;

/**
 * Receiving end of the local storage provider: the browser PUTs the file here with
 * the signature the app issued. Only runs when STORAGE_PROVIDER=local — with S3 or
 * R2 the browser uploads straight to the bucket and never touches this route.
 *
 * The signature covers the key, the operation and the expiry, so this endpoint
 * accepts nothing that the app did not authorize minutes earlier.
 */
export async function PUT(request: Request): Promise<Response> {
  const provider = getServices().storageProvider;
  if (!(provider instanceof LocalStorageProvider)) {
    return NextResponse.json({ error: "Local storage is not enabled" }, { status: 404 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const exp = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("sig") ?? "";

  if (!provider.verify("put", { key, exp, sig })) {
    return NextResponse.json({ error: "Link de upload inválido ou expirado" }, { status: 403 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo grande demais" }, { status: 413 });
  }

  try {
    const body = Buffer.from(await request.arrayBuffer());
    if (body.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Arquivo grande demais" }, { status: 413 });
    }
    await provider.write(key, body, request.headers.get("content-type") ?? "application/octet-stream");
    return NextResponse.json({ key, size: body.byteLength });
  } catch (error) {
    logger.error({ err: error, key }, "local storage upload failed");
    return NextResponse.json({ error: "Não foi possível salvar o arquivo" }, { status: 500 });
  }
}
