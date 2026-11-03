"use client";

import { useState, type ReactNode } from "react";

/**
 * Imagem da página de pagamento que some em vez de aparecer quebrada.
 *
 * Cliente só por causa disso: a URL é assinada e expira, o objeto pode ter sumido do bucket, e
 * ícone de imagem quebrada ao lado do preço custa confiança justamente na hora de pagar.
 *
 * Só o onError não resolve. A imagem vem renderizada do servidor e costuma falhar antes da
 * hidratação, quando ainda não há handler para ouvir o evento — dá para ver o ícone quebrado na
 * tela. Por isso, na montagem, o ref pergunta ao próprio elemento: terminou de carregar
 * (`complete`) e ficou sem largura (`naturalWidth === 0`) é como um <img> conta que falhou.
 */
export function SafeImage({
  src,
  alt,
  className,
  fallback = null,
}: {
  src: string | null;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL assinada que expira; otimizar cacharia um link morto
    <img
      src={src}
      alt={alt}
      className={className}
      ref={(node) => {
        if (node?.complete && node.naturalWidth === 0) setBroken(true);
      }}
      onError={() => setBroken(true)}
    />
  );
}
