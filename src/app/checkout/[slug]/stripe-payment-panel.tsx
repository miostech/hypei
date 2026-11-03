"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Loader2Icon, LockIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CheckoutDictionary } from "@/lib/i18n/checkout";
import { fill } from "@/lib/i18n/locale";

/**
 * Stripe Payment Element. Card data goes straight to Stripe — it never touches Kabrun's
 * servers. A successful confirmation here is NOT proof of payment: the webhook is.
 */
export function StripePaymentPanel({
  publishableKey,
  clientSecret,
  accentColor,
  returnUrl,
  amountLabel,
  dict,
}: {
  publishableKey: string;
  clientSecret: string;
  accentColor: string;
  returnUrl: string;
  amountLabel: string;
  dict: CheckoutDictionary;
}) {
  const stripePromise = useMemo<Promise<Stripe | null>>(() => loadStripe(publishableKey), [publishableKey]);

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: "stripe", variables: { colorPrimary: accentColor, borderRadius: "10px" } },
        // Os campos de cartão são da Stripe, não nossos: sem isto, um comprador alemão lia a
        // página em alemão e "Kartennummer" em português.
        locale: dict.localeTag,
      }}
    >
      <PaymentForm returnUrl={returnUrl} amountLabel={amountLabel} accentColor={accentColor} dict={dict} />
    </Elements>
  );
}

function PaymentForm({
  returnUrl,
  amountLabel,
  accentColor,
  dict,
}: {
  returnUrl: string;
  amountLabel: string;
  accentColor: string;
  dict: CheckoutDictionary;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!stripe || !elements) return;
        setSubmitting(true);
        setError(null);
        const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl } });
        if (result.error) {
          // A mensagem da Stripe já vem no locale que passamos ao Elements; a nossa só entra
          // quando ela não manda nenhuma.
          setError(result.error.message ?? dict.payment.failed);
          setSubmitting(false);
        }
      }}
    >
      <PaymentElement />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={!stripe || submitting} style={{ background: accentColor }}>
        {submitting ? <Loader2Icon className="animate-spin" /> : <LockIcon />}
        {fill(dict.payment.pay, { amount: amountLabel })}
      </Button>
    </form>
  );
}
