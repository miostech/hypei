"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Loader2Icon, LockIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Stripe Payment Element. Card data goes straight to Stripe — it never touches Hypei's
 * servers. A successful confirmation here is NOT proof of payment: the webhook is.
 */
export function StripePaymentPanel({
  publishableKey,
  clientSecret,
  accentColor,
  returnUrl,
  amountLabel,
}: {
  publishableKey: string;
  clientSecret: string;
  accentColor: string;
  returnUrl: string;
  amountLabel: string;
}) {
  const stripePromise = useMemo<Promise<Stripe | null>>(() => loadStripe(publishableKey), [publishableKey]);

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: "stripe", variables: { colorPrimary: accentColor, borderRadius: "10px" } },
        locale: "pt-BR",
      }}
    >
      <PaymentForm returnUrl={returnUrl} amountLabel={amountLabel} accentColor={accentColor} />
    </Elements>
  );
}

function PaymentForm({ returnUrl, amountLabel, accentColor }: { returnUrl: string; amountLabel: string; accentColor: string }) {
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
          setError(result.error.message ?? "Não foi possível concluir o pagamento.");
          setSubmitting(false);
        }
      }}
    >
      <PaymentElement />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={!stripe || submitting} style={{ background: accentColor }}>
        {submitting ? <Loader2Icon className="animate-spin" /> : <LockIcon />}
        Pagar {amountLabel}
      </Button>
    </form>
  );
}
