"use client";

import { BanknoteIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { idleState } from "@/lib/actions/action-state";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import { fill } from "@/lib/i18n/locale";
import { payAffiliate } from "./actions";

/**
 * Confirms before writing it down: the transfer itself happens outside Kabrun today,
 * so this button is a record, not a payment.
 */
export function PayAffiliateButton({ affiliateId, name, amountLabel }: { affiliateId: string; name: string; amountLabel: string }) {
  const dict = useAppDictionary();
  const t = dict.affiliates.pay;
  const [opened, setOpened] = useState(false);
  const [state, formAction] = useActionState(payAffiliate, idleState);
  const open = opened && state.status !== "success";

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? dict.toasts.saved);
    if (state.status === "error") toast.error(state.message);
  }, [state, dict]);

  return (
    <Dialog open={open} onOpenChange={setOpened}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <BanknoteIcon />
            {t.trigger}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fill(t.title, { name })}</DialogTitle>
          <DialogDescription>{fill(t.description, { name, amount: amountLabel })}</DialogDescription>
        </DialogHeader>

        <form action={formAction}>
          <input type="hidden" name="affiliateId" value={affiliateId} />
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{t.note}</p>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => setOpened(false)}>
              {dict.common.cancel}
            </Button>
            <SubmitButton>{t.confirm}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
