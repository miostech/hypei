"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { SelectField, TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { idleState } from "@/lib/actions/action-state";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import { fill } from "@/lib/i18n/locale";
import { createAffiliate, updateAffiliate } from "./actions";

export interface AffiliateValues {
  id: string;
  name: string;
  email: string;
  commission: string;
}

export function AffiliateDialog({
  affiliate,
  checkouts,
}: {
  affiliate?: AffiliateValues;
  checkouts: { id: string; name: string }[];
}) {
  const dict = useAppDictionary();
  const t = dict.affiliates.dialog;
  const [opened, setOpened] = useState(false);
  const [state, formAction] = useActionState(affiliate ? updateAffiliate : createAffiliate, idleState);
  const open = opened && state.status !== "success";
  const error = (field: string) => (state.status === "error" ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? dict.toasts.saved);
  }, [state, dict]);

  return (
    <Dialog open={open} onOpenChange={setOpened}>
      <DialogTrigger
        render={
          affiliate ? (
            <Button variant="ghost" size="icon-sm" aria-label={fill(dict.affiliates.edit, { name: affiliate.name })}>
              <PencilIcon />
            </Button>
          ) : (
            <Button>
              <PlusIcon />
              {t.new}
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{affiliate ? t.editTitle : t.new}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {affiliate && <input type="hidden" name="affiliateId" value={affiliate.id} />}

          <TextField label={dict.common.name} name="name" defaultValue={affiliate?.name} required autoFocus error={error("name")} />
          <TextField
            label={t.email}
            name="email"
            type="email"
            defaultValue={affiliate?.email}
            required
            hint={t.emailHint}
            error={error("email")}
          />
          <TextField
            label={t.commission}
            name="commissionBps"
            inputMode="decimal"
            placeholder="30"
            defaultValue={affiliate?.commission}
            required
            hint={t.commissionHint}
            error={error("commissionBps")}
          />

          {!affiliate && checkouts.length > 0 && (
            <SelectField label={t.checkout} name="checkoutId" error={error("checkoutId")}>
              {checkouts.map((checkout) => (
                <option key={checkout.id} value={checkout.id}>
                  {checkout.name}
                </option>
              ))}
            </SelectField>
          )}

          {state.status === "error" && !state.fieldErrors && <p className="text-xs text-destructive">{state.message}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpened(false)}>
              {dict.common.cancel}
            </Button>
            <SubmitButton>{affiliate ? dict.common.save : t.create}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
