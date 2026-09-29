"use client";

import { Loader2Icon, LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaymentMethodType } from "@/generated/prisma/enums";
import { SUPPORTED_COUNTRIES, COUNTRY_INFO } from "@/modules/organizations/countries";
import { PAYMENT_METHOD_LABELS } from "@/modules/payments/payment-method-resolver";
import type { TrackingInput } from "@/modules/checkout/checkout.schemas";
import { applyCouponAction, startCheckoutAction, trackCheckoutEvent } from "./actions";
import { useCoupon } from "./coupon-context";
import { MockPaymentPanel } from "./mock-payment-panel";
import { StripePaymentPanel } from "./stripe-payment-panel";

const SESSION_KEY = "ripay_checkout_session";

function sessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function CheckoutClient({
  slug,
  organizationId,
  checkoutId,
  collectPhone,
  collectCountry,
  paymentMethods,
  provider,
  publishableKey,
  accentColor,
  tracking,
  amountLabel,
}: {
  slug: string;
  organizationId: string;
  checkoutId: string;
  collectPhone: boolean;
  collectCountry: boolean;
  paymentMethods: PaymentMethodType[];
  provider: string;
  publishableKey: string | null;
  accentColor: string;
  tracking: TrackingInput;
  amountLabel: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<{ paymentId: string; clientSecret: string | null } | null>(null);
  const { coupon, setCoupon } = useCoupon();
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const attemptId = useMemo(() => crypto.randomUUID(), []);
  const payLabel = coupon?.total ?? amountLabel;

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setCheckingCoupon(true);
    setCouponError(null);
    const result = await applyCouponAction({ slug, code: couponInput });
    setCheckingCoupon(false);
    if (!result.ok || !result.code) {
      setCoupon(null);
      setCouponError(result.message ?? "Cupom inválido");
      return;
    }
    setCoupon({ code: result.code, discount: result.discount!, total: result.total! });
    toast.success(`Cupom ${result.code} aplicado`);
  }

  useEffect(() => {
    const referrer = typeof document !== "undefined" ? document.referrer || null : null;
    void trackCheckoutEvent({
      eventType: "checkout.viewed",
      organizationId,
      checkoutId,
      sessionId: sessionId(),
      tracking: { ...tracking, referrer },
    });
  }, [organizationId, checkoutId, tracking]);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    const referrer = typeof document !== "undefined" ? document.referrer || null : null;
    const result = await startCheckoutAction({
      slug,
      attemptId,
      sessionId: sessionId(),
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      country: collectCountry ? String(formData.get("country") ?? "") : undefined,
      couponCode: coupon?.code,
      tracking: { ...tracking, referrer },
    });
    setSubmitting(false);

    if (!result.ok || !result.paymentId) {
      setError(result.message ?? "Não foi possível iniciar o pagamento.");
      toast.error(result.message ?? "Não foi possível iniciar o pagamento.");
      return;
    }
    setPayment({ paymentId: result.paymentId, clientSecret: result.clientSecret ?? null });
  }

  if (payment) {
    return (
      <div className="space-y-5 rounded-2xl border bg-card p-6 shadow-soft">
        <h2 className="font-heading text-lg font-semibold">Pagamento</h2>
        {provider === "STRIPE" && publishableKey && payment.clientSecret ? (
          <StripePaymentPanel
            publishableKey={publishableKey}
            clientSecret={payment.clientSecret}
            accentColor={accentColor}
            returnUrl={`${window.location.origin}/checkout/${slug}/obrigado?payment=${payment.paymentId}`}
            amountLabel={payLabel}
          />
        ) : (
          <MockPaymentPanel
            paymentId={payment.paymentId}
            amountLabel={payLabel}
            onSettled={() => router.push(`/checkout/${slug}/obrigado?payment=${payment.paymentId}`)}
          />
        )}
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-5 rounded-2xl border bg-card p-6 shadow-soft">
      <h2 className="font-heading text-lg font-semibold">Seus dados</h2>

      <div className="space-y-1.5">
        <Label htmlFor="name">Nome completo</Label>
        <Input id="name" name="name" required autoComplete="name" className="h-11 rounded-xl" placeholder="Como no documento" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" className="h-11 rounded-xl" placeholder="voce@email.com" />
        <p className="text-xs text-muted-foreground">É para este e-mail que enviaremos o acesso.</p>
      </div>

      {collectPhone && (
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" className="h-11 rounded-xl" />
        </div>
      )}

      {collectCountry && (
        <div className="space-y-1.5">
          <Label htmlFor="country">País</Label>
          <select
            id="country"
            name="country"
            defaultValue="BR"
            className="flex h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {SUPPORTED_COUNTRIES.map((code) => (
              <option key={code} value={code}>
                {COUNTRY_INFO[code].name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5 border-t pt-4">
        <Label htmlFor="coupon">Cupom de desconto</Label>
        <div className="flex gap-2">
          <Input
            id="coupon"
            name="coupon"
            value={couponInput}
            onChange={(event) => {
              setCouponInput(event.target.value.toUpperCase());
              setCouponError(null);
            }}
            onKeyDown={(event) => {
              // Enter inside the coupon field applies the code; it must not submit the order.
              if (event.key === "Enter") {
                event.preventDefault();
                void applyCoupon();
              }
            }}
            disabled={Boolean(coupon)}
            placeholder="Tem um cupom?"
            autoComplete="off"
            className="h-11 rounded-xl uppercase"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl px-4"
            disabled={checkingCoupon || !couponInput.trim()}
            onClick={() => (coupon ? (setCoupon(null), setCouponInput("")) : void applyCoupon())}
          >
            {checkingCoupon ? <Loader2Icon className="animate-spin" /> : coupon ? "Remover" : "Aplicar"}
          </Button>
        </div>
        {couponError && <p className="text-xs text-destructive">{couponError}</p>}
        {coupon && (
          <p className="flex items-center justify-between rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
            <span>Cupom {coupon.code}</span>
            <span className="font-semibold">− {coupon.discount}</span>
          </p>
        )}
      </div>

      {paymentMethods.length > 0 && (
        <p className="text-xs text-muted-foreground">Formas de pagamento disponíveis: {paymentMethods.map((m) => PAYMENT_METHOD_LABELS[m]).join(", ")}.</p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" disabled={submitting} style={{ background: accentColor }}>
        {submitting ? <Loader2Icon className="animate-spin" /> : <LockIcon />}
        Ir para o pagamento · {payLabel}
      </Button>
    </form>
  );
}
