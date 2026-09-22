"use client";

import { BanknoteIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { TextField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { idleState } from "@/lib/actions/action-state";
import { requestPayout } from "./actions";

export function RequestPayoutDialog({
  currency,
  availableAmount,
  availableLabel,
  disabled,
}: {
  currency: string;
  availableAmount: string;
  availableLabel: string;
  disabled: boolean;
}) {
  const [requested, setRequested] = useState(false);
  const [state, formAction] = useActionState(requestPayout, idleState);
  // Stable per dialog session: retrying the same request never creates a second payout.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  // Derived: a successful request closes the dialog without a state sync effect.
  const open = requested && state.status !== "success";

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Saque solicitado");
  }, [state]);

  const maxDecimal = (Number(availableAmount) / 100).toFixed(2);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setRequestId(crypto.randomUUID());
        setRequested(next);
      }}
    >
      <DialogTrigger
        render={
          <Button disabled={disabled}>
            <BanknoteIcon />
            Solicitar saque
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar saque</DialogTitle>
          <DialogDescription>
            Disponível para saque: <strong>{availableLabel}</strong>. O valor sai do saldo disponível assim que a solicitação é registrada.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="requestId" value={requestId} />
          <TextField
            label={`Valor (${currency})`}
            name="amount"
            inputMode="decimal"
            placeholder={maxDecimal}
            defaultValue={maxDecimal}
            required
            error={state.status === "error" ? (state.fieldErrors?.amount ?? state.message) : undefined}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRequested(false)}>
              Cancelar
            </Button>
            <SubmitButton pendingLabel="Solicitando…">Confirmar saque</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
