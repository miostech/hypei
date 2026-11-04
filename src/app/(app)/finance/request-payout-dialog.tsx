"use client";

import { BanknoteIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { TextField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { idleState } from "@/lib/actions/action-state";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import { fill } from "@/lib/i18n/locale";
import { requestPayout } from "./actions";

export function RequestPayoutDialog({
  currency,
  payoutCurrency,
  rate,
  rateLabel,
  availableAmount,
  availableLabel,
  feeAmount,
  feeLabel,
  disabled,
}: {
  /** A moeda do saldo: é nela que ela digita o valor. */
  currency: string;
  /** A moeda da conta de recebimento, em que o dinheiro realmente cai. */
  payoutCurrency: string;
  /** Cotação atual na escala de 1e8, como string, ou nula quando não há conversão. */
  rate: string | null;
  /** Quanto vale 1 unidade da moeda do saldo, já formatado. */
  rateLabel: string | null;
  /** Unidades menores, como string: bigint não atravessa a fronteira do servidor. */
  availableAmount: string;
  availableLabel: string;
  feeAmount: string;
  feeLabel: string;
  disabled: boolean;
}) {
  const dict = useAppDictionary();
  const t = dict.payouts.dialog;
  const [requested, setRequested] = useState(false);
  const [state, formAction] = useActionState(requestPayout, idleState);
  // Stable per dialog session: retrying the same request never creates a second payout.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  // Derived: a successful request closes the dialog without a state sync effect.
  const open = requested && state.status !== "success";

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? dict.toasts.payoutRequested);
  }, [state, dict]);

  const maxDecimal = (Number(availableAmount) / 100).toFixed(2);
  const [amount, setAmount] = useState(maxDecimal);

  // O que ela vê depois da taxa, enquanto digita. Valor inválido ou menor que a taxa não
  // mostra número nenhum: o servidor é quem recusa, e aqui inventar um negativo só confunde.
  const typed = Math.round(Number(amount.replace(",", ".")) * 100);
  // Com conversão, o que ela recebe é o valor convertido menos a taxa — ambos na moeda da
  // conta. É uma prévia: o número que vale é o da cotação no instante da confirmação.
  const converted = rate ? Math.round((typed * Number(rate)) / 1e8) : typed;
  const net = Number.isFinite(converted) && converted > Number(feeAmount) ? (converted - Number(feeAmount)) / 100 : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Abrir de novo recomeça do zero: chave nova e o saldo de agora no campo, que pode
        // ter mudado desde que a tela carregou.
        if (next) {
          setRequestId(crypto.randomUUID());
          setAmount(maxDecimal);
        }
        setRequested(next);
      }}
    >
      <DialogTrigger
        render={
          <Button disabled={disabled}>
            <BanknoteIcon />
            {dict.finance.requestPayout}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{fill(t.description, { amount: availableLabel })}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="currency" value={currency} />
          <TextField
            label={fill(t.amount, { currency })}
            name="amount"
            inputMode="decimal"
            placeholder={maxDecimal}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            error={state.status === "error" ? (state.fieldErrors?.amount ?? state.message) : undefined}
          />

          <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
            {rateLabel && <p>{fill(t.rate, { from: currency, amount: rateLabel })}</p>}
            <p>{fill(t.fee, { amount: feeLabel })}</p>
            {net !== null && (
              <p className="mt-1 font-medium text-foreground">
                {fill(t.net, { amount: net.toLocaleString(dict.localeTag, { style: "currency", currency: payoutCurrency }) })}
              </p>
            )}
            {rateLabel && <p className="mt-1">{t.rateHint}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRequested(false)}>
              {dict.common.cancel}
            </Button>
            <SubmitButton pendingLabel={t.pending}>{t.confirm}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
