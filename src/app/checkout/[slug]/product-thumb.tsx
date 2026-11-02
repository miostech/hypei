"use client";

import { useState } from "react";

/**
 * Imagem do produto no resumo do pedido, com as iniciais como reserva.
 *
 * Cliente só por causa do onError: a URL é colada pelo produtor e pode quebrar a qualquer
 * momento, e ícone de imagem quebrada ao lado do preço custa confiança na hora de pagar.
 */
export function ProductThumb({ name, thumbnailUrl, accent }: { name: string; thumbnailUrl: string | null; accent: string }) {
  const [broken, setBroken] = useState(false);

  if (!thumbnailUrl || broken) {
    return (
      <span
        aria-hidden
        className="flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
        style={{ background: accent }}
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL externa do produtor, igual ao logo
    <img
      src={thumbnailUrl}
      alt=""
      className="size-12 shrink-0 rounded-xl border object-cover"
      /**
       * A imagem vem do servidor e costuma falhar antes da hidratação, quando ainda não há
       * onError para ouvir. Na montagem a gente pergunta ao próprio elemento: terminou de
       * carregar (`complete`) e ficou sem largura (`naturalWidth === 0`) quer dizer que falhou.
       */
      ref={(node) => {
        if (node?.complete && node.naturalWidth === 0) setBroken(true);
      }}
      onError={() => setBroken(true)}
    />
  );
}
