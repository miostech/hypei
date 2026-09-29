"use client";

import { BanknoteIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { idleState } from "@/lib/actions/action-state";
import { payAffiliate } from "./actions";

/**
 * Confirms before writing it down: the transfer itself happens outside Ripay today,
 * so this button is a record, not a payment.
 */
export function PayAffiliateButton({ affiliateId, name, amountLabel }: { affiliateId: string; name: string; amountLabel: string }) {
  const [opened, setOpened] = useState(false);
  const [state, formAction] = useActionState(payAffiliate, idleState);
  const open = opened && state.status !== "success";

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Comissões marcadas como pagas");
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpened}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <BanknoteIcon />
            Pagar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento a {name}</DialogTitle>
          <DialogDescription>
            Confirma que você transferiu {amountLabel} para {name}? O valor sai do que a Ripay tem reservado para este afiliado.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction}>
          <input type="hidden" name="affiliateId" value={affiliateId} />
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            A transferência é feita por fora da plataforma. Este registro apenas baixa a comissão e mantém o histórico.
          </p>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => setOpened(false)}>
              Cancelar
            </Button>
            <SubmitButton>Confirmar pagamento</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
