"use client";

import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { simulateMockPayment } from "./actions";

/**
 * Development-only payment step. Clicking here asks the mock provider to emit a SIGNED
 * webhook — the payment is confirmed through the same pipeline a real provider uses,
 * never by this button directly.
 */
export function MockPaymentPanel({ paymentId, amountLabel, onSettled }: { paymentId: string; amountLabel: string; onSettled: () => void }) {
  const [pending, setPending] = useState<"succeeded" | "failed" | null>(null);

  async function simulate(outcome: "succeeded" | "failed") {
    setPending(outcome);
    const result = await simulateMockPayment(paymentId, outcome);
    if (!result.ok) {
      toast.error(result.message ?? "Falha ao simular");
      setPending(null);
      return;
    }
    // Give the webhook pipeline a moment before showing the result page.
    setTimeout(onSettled, 600);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Ambiente de desenvolvimento com provedor simulado. Nenhuma cobrança real acontece — o pagamento é confirmado por um webhook assinado.
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" className="flex-1" disabled={pending !== null} onClick={() => simulate("succeeded")}>
          {pending === "succeeded" ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />}
          Simular pagamento aprovado · {amountLabel}
        </Button>
        <Button size="lg" variant="outline" disabled={pending !== null} onClick={() => simulate("failed")}>
          {pending === "failed" ? <Loader2Icon className="animate-spin" /> : <XCircleIcon />}
          Simular recusa
        </Button>
      </div>
    </div>
  );
}
