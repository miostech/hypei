"use client";

import { TruckIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { idleState } from "@/lib/actions/action-state";
import { registerAwardShipping } from "./actions";

export function ShipAwardDialog({ awardId, organizationName, tierLabel }: { awardId: string; organizationName: string; tierLabel: string }) {
  const [opened, setOpened] = useState(false);
  const [state, formAction] = useActionState(registerAwardShipping, idleState);
  const open = opened && state.status !== "success";

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Envio registrado");
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpened}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <TruckIcon />
            Registrar envio
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar placa {tierLabel}</DialogTitle>
          <DialogDescription>Para {organizationName}. O código aparece na tela de premiações do produtor.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="awardId" value={awardId} />
          <TextField
            label="Código de rastreio"
            name="trackingCode"
            placeholder="BR123456789BR"
            hint="Opcional: deixe vazio se ainda não tiver o código."
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpened(false)}>
              Cancelar
            </Button>
            <SubmitButton>Confirmar envio</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
