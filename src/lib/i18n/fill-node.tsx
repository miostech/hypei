import type { ReactNode } from "react";

/**
 * Como `fill`, mas para um buraco que recebe um nó React em vez de texto — o nome do vendedor
 * em negrito, o logotipo da Kabrun no rodapé.
 *
 * Sem isto a alternativa era partir a frase no dicionário ("Vendido por" + nome) ou abrir mão
 * do destaque. Partir é pior: em alemão "Zahlung abgewickelt von Kabrun" põe a marca no fim e
 * em outra ordem, e um pedaço solto não tem como dizer isso ao tradutor.
 */
export function fillNode(template: string, key: string, node: ReactNode): ReactNode {
  const marker = `{${key}}`;
  const index = template.indexOf(marker);
  if (index < 0) return template;
  return (
    <>
      {template.slice(0, index)}
      {node}
      {template.slice(index + marker.length)}
    </>
  );
}
