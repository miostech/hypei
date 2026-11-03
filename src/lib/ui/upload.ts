/**
 * Sends a file straight to storage with the signed URL the server hands out, so nothing
 * passes through the app server. XMLHttpRequest instead of fetch because it is the only
 * one that reports upload progress.
 */
export function uploadToStorage(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () =>
      request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`Upload falhou (${request.status})`)),
    );
    request.addEventListener("error", () => reject(new Error("Falha de rede durante o envio")));
    request.addEventListener("abort", () => reject(new Error("Envio cancelado")));
    request.send(file);
  });
}
