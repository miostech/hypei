"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getPaymentStatus } from "../actions";

/** Polls the Ripay payment status until the provider webhook settles it. */
export function PaymentStatusWatcher({ paymentId }: { paymentId: string }) {
  const router = useRouter();

  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const { status } = await getPaymentStatus(paymentId);
      if (status === "PAID" || status === "FAILED" || status === "CANCELED" || attempts > 20) {
        clearInterval(interval);
        router.refresh();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [paymentId, router]);

  return <p className="text-xs text-muted-foreground">Aguardando confirmação do provedor de pagamento…</p>;
}
