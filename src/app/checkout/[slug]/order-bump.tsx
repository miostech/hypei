"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import type { CheckoutDictionary } from "@/lib/i18n/checkout";
import { useCheckoutState } from "./checkout-state";

/**
 * As ofertas adicionais, marcáveis com um clique.
 *
 * Cada caixa é um `<button>` inteiro e não um checkbox com rótulo ao lado: a área de clique é
 * o cartão todo, que é o que alguém no celular acerta. O `aria-pressed` é o que diz ao leitor
 * de tela que aquilo liga e desliga, já que a aparência de botão esconde o estado.
 *
 * Nada aqui manda valor para o servidor. O que vai no envio é o id do que foi marcado; o preço
 * o servidor relê da versão do checkout.
 */
export function OrderBumps({ dict, accentColor }: { dict: CheckoutDictionary; accentColor: string }) {
  const { bumps, selectedBumps, toggleBump, format } = useCheckoutState();
  if (bumps.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-semibold">{dict.bump.title}</h2>
      {bumps.map((bump) => {
        const added = selectedBumps.includes(bump.offerId);
        return (
          <button
            key={bump.offerId}
            type="button"
            onClick={() => toggleBump(bump.offerId)}
            aria-pressed={added}
            className="flex w-full items-start gap-3 rounded-xl border-2 border-dashed bg-card p-4 text-left transition-colors hover:bg-muted/40"
            style={added ? { borderColor: accentColor, borderStyle: "solid" } : undefined}
          >
            <span
              aria-hidden
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2"
              style={added ? { background: accentColor, borderColor: accentColor } : undefined}
            >
              {added && <CheckIcon className="size-3.5 text-white" />}
            </span>

            <span className="min-w-0 flex-1 space-y-1">
              <span className="block font-medium text-pretty">{bump.headline}</span>
              {bump.description && <span className="block text-sm text-pretty text-muted-foreground">{bump.description}</span>}
              <span className="flex flex-wrap items-baseline gap-2 pt-0.5">
                {bump.compareAtAmount && (
                  <span className="text-sm text-muted-foreground line-through">{format(bump.compareAtAmount)}</span>
                )}
                <span className="font-heading font-bold" style={{ color: accentColor }}>
                  {format(bump.amount)}
                </span>
              </span>
            </span>

            <span className="flex shrink-0 items-center gap-1 text-sm font-medium" style={{ color: added ? accentColor : undefined }}>
              {added ? (
                <>
                  <CheckIcon className="size-4" aria-hidden /> {dict.bump.added}
                </>
              ) : (
                <>
                  <PlusIcon className="size-4" aria-hidden /> {dict.bump.add}
                </>
              )}
            </span>
          </button>
        );
      })}
      <p className="text-xs text-muted-foreground">{dict.bump.hint}</p>
    </section>
  );
}
