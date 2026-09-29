"use client";

import { XCircleIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { idleState } from "@/lib/actions/action-state";
import { cancelSubscription } from "./actions";

export function CancelSubscriptionDialog({
  subscriptionId,
  customerName,
  periodEndLabel,
}: {
  subscriptionId: string;
  customerName: string;
  periodEndLabel: string | null;
}) {
  const [opened, setOpened] = useState(false);
  const [mode, setMode] = useState<"at_period_end" | "now">("at_period_end");
  const [state, formAction] = useActionState(cancelSubscription, idleState);
  const open = opened && state.status !== "success";

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Assinatura cancelada");
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpened}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Cancelar assinatura de ${customerName}`}>
            <XCircleIcon />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar assinatura de {customerName}</DialogTitle>
          <DialogDescription>Não haverá novas cobranças. Escolha o que acontece com o acesso.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="subscriptionId" value={subscriptionId} />
          <input type="hidden" name="mode" value={mode} />

          <div className="space-y-2">
            {(
              [
                {
                  value: "at_period_end" as const,
                  title: "No fim do período",
                  detail: periodEndLabel
                    ? `Mantém o acesso até ${periodEndLabel}, que o cliente já pagou.`
                    : "Mantém o acesso até o fim do período já pago.",
                },
                {
                  value: "now" as const,
                  title: "Agora",
                  detail: "Corta o acesso imediatamente, mesmo com período pago em aberto.",
                },
              ]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                aria-pressed={mode === option.value}
                className={`w-full rounded-xl border p-3 text-left text-sm transition-colors ${
                  mode === option.value ? "border-primary bg-accent/60" : "hover:bg-muted/60"
                }`}
              >
                <span className="font-medium">{option.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{option.detail}</span>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpened(false)}>
              Voltar
            </Button>
            <SubmitButton variant="destructive">Cancelar assinatura</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
