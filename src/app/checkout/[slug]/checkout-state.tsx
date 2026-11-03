"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CheckoutDictionary } from "@/lib/i18n/checkout";
import { fill } from "@/lib/i18n/locale";
import { formatAmount } from "@/lib/ui/format";

/**
 * Uma oferta adicional como ela atravessa o limite servidor → cliente.
 *
 * Os valores vêm em string de unidades menores porque `bigint` não sobrevive à serialização
 * de props. Viram `bigint` de volta na primeira linha que faz conta com eles: dinheiro nunca
 * é somado como número aqui.
 */
export interface BumpOption {
  offerId: string;
  productName: string;
  headline: string;
  description: string;
  amount: string;
  compareAtAmount: string | null;
}

export interface AppliedCoupon {
  code: string;
  /** Unidades menores, em string. O desconto incide só sobre a oferta principal. */
  discountAmount: string;
}

interface CheckoutStateValue {
  coupon: AppliedCoupon | null;
  setCoupon: (coupon: AppliedCoupon | null) => void;
  bumps: BumpOption[];
  selectedBumps: string[];
  toggleBump: (offerId: string) => void;
  /** Oferta principal + bumps marcados, antes do desconto. */
  subtotal: bigint;
  discount: bigint;
  total: bigint;
  format: (amount: bigint | string) => string;
}

const CheckoutStateContext = createContext<CheckoutStateValue | null>(null);

/**
 * O dinheiro do checkout, calculado num lugar só.
 *
 * O formulário, as caixas de bump e o resumo do pedido ficam em ramos diferentes da página, e
 * os três mostram o mesmo total. Antes só o cupom precisava disso; com o bump, o valor muda
 * por dois motivos independentes, e duas contas paralelas divergiriam na primeira borda de
 * arredondamento. A soma aqui espelha a do servidor — que é quem cobra, e manda.
 */
export function CheckoutStateProvider({
  offerAmount,
  currency,
  bumps,
  children,
}: {
  /** Preço oficial da oferta, em unidades menores. Vem do Postgres, nunca do config. */
  offerAmount: string;
  currency: string;
  bumps: BumpOption[];
  children: ReactNode;
}) {
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [selectedBumps, setSelectedBumps] = useState<string[]>([]);

  const value = useMemo<CheckoutStateValue>(() => {
    const bumpTotal = bumps
      .filter((bump) => selectedBumps.includes(bump.offerId))
      .reduce((sum, bump) => sum + BigInt(bump.amount), 0n);
    const subtotal = BigInt(offerAmount) + bumpTotal;
    const discount = coupon ? BigInt(coupon.discountAmount) : 0n;

    return {
      coupon,
      setCoupon,
      bumps,
      selectedBumps,
      toggleBump: (offerId) =>
        setSelectedBumps((current) => (current.includes(offerId) ? current.filter((id) => id !== offerId) : [...current, offerId])),
      subtotal,
      discount,
      total: subtotal - discount,
      // Sem locale de propósito: nesta base o dinheiro segue a MOEDA, não o idioma de quem lê
      // (BRL em pt-BR, EUR em pt-PT, o resto em en-US). Passar o idioma aqui faria o preço do
      // bump sair num formato e o da oferta em outro, na mesma tela.
      format: (amount) => formatAmount(amount, currency),
    };
  }, [coupon, selectedBumps, bumps, offerAmount, currency]);

  return <CheckoutStateContext.Provider value={value}>{children}</CheckoutStateContext.Provider>;
}

export function useCheckoutState(): CheckoutStateValue {
  const context = useContext(CheckoutStateContext);
  if (!context) throw new Error("useCheckoutState must be used inside CheckoutStateProvider");
  return context;
}

export function OrderTotals({ dict }: { dict: CheckoutDictionary }) {
  const { coupon, bumps, selectedBumps, subtotal, discount, total, format } = useCheckoutState();
  const added = bumps.filter((bump) => selectedBumps.includes(bump.offerId));

  return (
    <>
      {added.map((bump) => (
        <div key={bump.offerId} className="flex items-center justify-between text-sm">
          <span className="min-w-0 truncate text-muted-foreground">+ {bump.productName}</span>
          <span className="tabular shrink-0 pl-2">{format(bump.amount)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{dict.summary.subtotal}</span>
        <span className="tabular">{format(subtotal)}</span>
      </div>
      {coupon && (
        <div className="flex items-center justify-between text-sm text-success">
          <span>{fill(dict.coupon.line, { code: coupon.code })}</span>
          <span className="tabular">− {format(discount)}</span>
        </div>
      )}
      <div className="flex items-center justify-between border-t pt-4">
        <span className="font-medium">{dict.summary.total}</span>
        <span className="tabular font-heading text-xl font-bold">{format(total)}</span>
      </div>
    </>
  );
}
