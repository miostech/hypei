import { ValidationError } from "@/lib/errors";

/**
 * Imagens que o produtor envia: capa do produto, banner e logo do checkout.
 *
 * Este módulo roda nos dois lados — o campo de upload é client component e lê o teto daqui —
 * então não pode importar nada de servidor. Assinar a URL mora no storage, não aqui.
 *
 * O teto é baixo de propósito. Tudo isto aparece na página de pagamento, onde cada segundo de
 * carregamento custa venda — não é lugar para o PNG de 20 MB que saiu do Canva. E só formatos
 * que todo navegador abre: um .heic do iPhone não renderiza no Chrome do comprador.
 */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_MAX_BYTES = 4_000_000;

export function assertUploadableImage(input: { contentType: string; sizeBytes: number }): void {
  if (!IMAGE_TYPES.includes(input.contentType)) {
    throw new ValidationError("Use uma imagem JPG, PNG ou WebP");
  }
  if (input.sizeBytes <= 0) throw new ValidationError("Arquivo vazio");
  if (input.sizeBytes > IMAGE_MAX_BYTES) {
    throw new ValidationError(`A imagem passa do limite de ${Math.round(IMAGE_MAX_BYTES / 1_000_000)} MB`);
  }
}
