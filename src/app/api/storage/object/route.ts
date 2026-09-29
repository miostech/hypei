import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { LocalStorageProvider } from "@/lib/providers/storage";
import { getServices } from "@/server/container";

/**
 * Serving end of the local storage provider. The URL is signed and short-lived,
 * so a link copied out of the player stops working once it expires — the same
 * guarantee a presigned S3 URL gives.
 */
export async function GET(request: Request): Promise<Response> {
  const provider = getServices().storageProvider;
  if (!(provider instanceof LocalStorageProvider)) {
    return NextResponse.json({ error: "Local storage is not enabled" }, { status: 404 });
  }

  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const exp = url.searchParams.get("exp") ?? "";
  const sig = url.searchParams.get("sig") ?? "";
  const downloadName = url.searchParams.get("name");

  if (!provider.verify("get", { key, exp, sig })) {
    return NextResponse.json({ error: "Link expirado" }, { status: 403 });
  }

  try {
    const file = await provider.read(key);
    const headers = new Headers({
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      // Private: the URL is per-viewer and short-lived, so nothing should cache it.
      "Cache-Control": "private, max-age=0, no-store",
      "Accept-Ranges": "none",
    });
    if (downloadName) {
      headers.set("Content-Disposition", `attachment; filename="${downloadName.replace(/["\\]/g, "")}"`);
    }
    return new Response(new Uint8Array(file.body), { headers });
  } catch (error) {
    logger.warn({ err: error, key }, "local storage object not found");
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
}
