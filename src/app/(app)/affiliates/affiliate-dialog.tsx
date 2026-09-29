"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { SelectField, TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { idleState } from "@/lib/actions/action-state";
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
  const [opened, setOpened] = useState(false);
  const [state, formAction] = useActionState(affiliate ? updateAffiliate : createAffiliate, idleState);
  const open = opened && state.status !== "success";
  const error = (field: string) => (state.status === "error" ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Salvo");
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpened}>
      <DialogTrigger
        render={
          affiliate ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${affiliate.name}`}>
              <PencilIcon />
            </Button>
          ) : (
            <Button>
              <PlusIcon />
              Novo afiliado
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{affiliate ? "Editar afiliado" : "Novo afiliado"}</DialogTitle>
          <DialogDescription>
            A comissão sai da sua parte da venda, depois das taxas, e fica reservada até você pagar o afiliado.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {affiliate && <input type="hidden" name="affiliateId" value={affiliate.id} />}

          <TextField label="Nome" name="name" defaultValue={affiliate?.name} required autoFocus error={error("name")} />
          <TextField
            label="E-mail"
            name="email"
            type="email"
            defaultValue={affiliate?.email}
            required
            hint="É por ele que você identifica e paga o afiliado."
            error={error("email")}
          />
          <TextField
            label="Comissão (%)"
            name="commissionBps"
            inputMode="decimal"
            placeholder="30"
            defaultValue={affiliate?.commission}
            required
            hint="Percentual sobre o valor da venda, já com desconto aplicado."
            error={error("commissionBps")}
          />

          {!affiliate && checkouts.length > 0 && (
            <SelectField label="Link para qual checkout" name="checkoutId" error={error("checkoutId")}>
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
              Cancelar
            </Button>
            <SubmitButton>{affiliate ? "Salvar" : "Cadastrar"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
