"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AppDictionary } from "./pt";

const AppDictionaryContext = createContext<AppDictionary | null>(null);

/**
 * O dicionário do produtor descendo por contexto em vez de prop.
 *
 * No checkout e na área de membros a prop bastava — sete arquivos, três arquivos. Aqui são 49
 * client components: formulário, diálogo, tabela, botão de confirmação. Passar o dicionário à
 * mão por essa árvore seria uma prop nova em cada camada só para o texto chegar na folha.
 *
 * O layout resolve o idioma no servidor e injeta aqui; quem renderiza chama `useAppDictionary`.
 */
export function AppDictionaryProvider({ dict, children }: { dict: AppDictionary; children: ReactNode }) {
  return <AppDictionaryContext.Provider value={dict}>{children}</AppDictionaryContext.Provider>;
}

export function useAppDictionary(): AppDictionary {
  const dict = useContext(AppDictionaryContext);
  if (!dict) throw new Error("useAppDictionary must be used inside AppDictionaryProvider");
  return dict;
}
