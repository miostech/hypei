"use client";

import { RotateCcwIcon } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { idleState } from "@/lib/actions/action-state";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import { fill } from "@/lib/i18n/locale";
import { formatAmount } from "@/lib/ui/format";
import { requestRefund } from "./actions";

export function RefundDialog({
  paymentId,
  refundableAmount,
  currency,
  partiallyRefunded,
}: {
  paymentId: string;
  refundableAmount: string;
  currency: string;
  partiallyRefunded: boolean;
}) {
  const dict = useAppDictionary();
  const t = dict.refundDialog;
  const [opened, setOpened] = useState(false);
  const [state, formAction] = useActionState(requestRefund, idleState);
  const [scope, setScope] = useState<"full" | "partial">("full");
  const open = opened && state.status !== "success";

  // A fresh key per dialog opening: resubmitting the same form never refunds twice.
  const idempotencyKey = useMemo(() => (opened ? crypto.randomUUID() : ""), [opened]);
  const refundable = formatAmount(refundableAmount, currency);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? t.submitted);
  }, [state, t.submitted]);

  return (
    <Dialog open={open} onOpenChange={setOpened}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <RotateCcwIcon />
            {t.trigger}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>
            {t.description} {partiallyRefunded ? `${t.partialNote} ` : ""}
            {fill(t.available, { amount: refundable })}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="paymentId" value={paymentId} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <input type="hidden" name="scope" value={scope} />

          <div className="grid gap-2 sm:grid-cols-2">
            {(["full", "partial"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setScope(option)}
                aria-pressed={scope === option}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  scope === option ? "border-primary bg-accent/60 font-medium" : "hover:bg-muted/60"
                }`}
              >
                {option === "full" ? t.full : t.partial}
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {option === "full" ? refundable : t.partialHint}
                </span>
              </button>
            ))}
          </div>

          {scope === "partial" && (
            <TextField
              label={t.amountLabel}
              name="amount"
              inputMode="decimal"
              placeholder={t.amountPlaceholder}
              required
              autoFocus
              error={state.status === "error" ? state.fieldErrors?.amount : undefined}
            />
          )}

          <TextField
            label={t.reasonLabel}
            name="reason"
            maxLength={200}
            placeholder={t.reasonPlaceholder}
            hint={t.reasonHint}
          />

          {state.status === "error" && !state.fieldErrors && <p className="text-xs text-destructive">{state.message}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpened(false)}>
              {dict.common.cancel}
            </Button>
            <SubmitButton>{t.trigger}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
