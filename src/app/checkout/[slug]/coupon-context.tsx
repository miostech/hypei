"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface AppliedCoupon {
  code: string;
  discount: string;
  total: string;
}

interface CouponContextValue {
  coupon: AppliedCoupon | null;
  setCoupon: (coupon: AppliedCoupon | null) => void;
}

const CouponContext = createContext<CouponContextValue | null>(null);

/**
 * Shared between the form and the order summary, which sit in different branches of
 * the page: a discount must never show in one place and not the other.
 */
export function CouponProvider({ children }: { children: ReactNode }) {
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const value = useMemo(() => ({ coupon, setCoupon }), [coupon]);
  return <CouponContext.Provider value={value}>{children}</CouponContext.Provider>;
}

export function useCoupon(): CouponContextValue {
  const context = useContext(CouponContext);
  if (!context) throw new Error("useCoupon must be used inside CouponProvider");
  return context;
}

export function OrderTotals({ subtotalLabel }: { subtotalLabel: string }) {
  const { coupon } = useCoupon();

  return (
    <>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="tabular">{subtotalLabel}</span>
      </div>
      {coupon && (
        <div className="flex items-center justify-between text-sm text-success">
          <span>Cupom {coupon.code}</span>
          <span className="tabular">− {coupon.discount}</span>
        </div>
      )}
      <div className="flex items-center justify-between border-t pt-4">
        <span className="font-medium">Total</span>
        <span className="tabular font-heading text-xl font-bold">{coupon?.total ?? subtotalLabel}</span>
      </div>
    </>
  );
}
