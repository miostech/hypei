"use client";

import { PencilIcon, RotateCcwIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { idleState } from "@/lib/actions/action-state";
import { formatAmount } from "@/lib/ui/format";
import { resetNegotiatedFee, saveNegotiatedFee } from "./actions";

/** O que a página serializa para cá: bigint não atravessa a fronteira de servidor. */
export interface FeeRow {
  currency: string;
  percentageBps: number;
  fixedAmount: string;
  publishedPercentageBps: number;
  publishedFixedAmount: string;
  negotiated: boolean;
}

/** "8,99% + R$ 2,49" — como a landing page escreve, para o admin comparar de olho. */
function describe(percentageBps: number, fixedAmount: string, currency: string) {
  const percentage = (percentageBps / 100).toFixed(2).replace(".", ",");
  return BigInt(fixedAmount) === 0n ? `${percentage}%` : `${percentage}% + ${formatAmount(fixedAmount, currency)}`;
}

/** O que a produtora recebe numa venda de 100 unidades da moeda, para a taxa deixar de ser abstrata. */
const REFERENCE_SALE = 10_000n;

export function PlatformFeeCard({ organizationId, rows }: { organizationId: string; rows: FeeRow[] }) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle>Taxa da plataforma</CardTitle>
        <CardDescription>
          Por padrão todo produtor paga a taxa anunciada. A condição negociada aqui vale da próxima venda em diante — venda já paga guarda a
          taxa que foi cobrada nela.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => {
          const fixed = BigInt(row.fixedAmount);
          const fee = (REFERENCE_SALE * BigInt(row.percentageBps)) / 10_000n + fixed;
          const net = REFERENCE_SALE - fee;
          return (
            <div key={row.currency} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="tabular">{describe(row.percentageBps, row.fixedAmount, row.currency)}</span>
                  {row.negotiated ? (
                    <Badge variant="warning">Negociada</Badge>
                  ) : (
                    <Badge variant="outline">Padrão</Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.negotiated && `Padrão: ${describe(row.publishedPercentageBps, row.publishedFixedAmount, row.currency)} · `}
                  Numa venda de {formatAmount(REFERENCE_SALE, row.currency)} o produtor recebe{" "}
                  <span className="tabular font-medium text-foreground">{net > 0n ? formatAmount(net, row.currency) : formatAmount(0, row.currency)}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {row.negotiated && <ResetButton organizationId={organizationId} currency={row.currency} />}
                <EditDialog organizationId={organizationId} row={row} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function EditDialog({ organizationId, row }: { organizationId: string; row: FeeRow }) {
  const [opened, setOpened] = useState(false);
  const [state, formAction] = useActionState(saveNegotiatedFee, idleState);
  const open = opened && state.status !== "success";
  const fieldError = (field: string) => (state.status === "error" ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Taxa atualizada");
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpened}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <PencilIcon />
            {row.negotiated ? "Mudar" : "Negociar"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Taxa em {row.currency}</DialogTitle>
          <DialogDescription>
            O produtor passa a ver esta taxa no Financeiro dele e a pagar só ela. O que a Kabrun paga ao adquirente continua saindo daqui, então
            uma taxa baixa come o lucro da venda.
          </DialogDescription>
        </DialogHeader>
        {/*
          A `key` carrega a taxa, não só a moeda. Ela separa o diálogo de cada linha — sem isso
          o do dólar abriria com o número do real — e remonta o campo quando a taxa muda: o
          `defaultValue` de um input montado o Base UI ignora, e avisa no console que ignorou.
        */}
        <form action={formAction} className="space-y-4" key={`${row.currency}-${row.percentageBps}-${row.fixedAmount}`}>
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="currency" value={row.currency} />
          <TextField
            label="Porcentagem"
            name="percentage"
            defaultValue={(row.percentageBps / 100).toFixed(2).replace(".", ",")}
            hint="Sobre o valor da venda. Padrão: 8,99 no real, 9,99 nas outras moedas."
            error={fieldError("percentage")}
          />
          <TextField
            label="Parte fixa"
            name="fixedAmount"
            defaultValue={String(Number(row.fixedAmount) / 100).replace(".", ",")}
            hint="Por venda, na moeda. Zero se a condição é só percentual."
            error={fieldError("fixedAmount")}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpened(false)}>
              Cancelar
            </Button>
            <SubmitButton>Salvar taxa</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetButton({ organizationId, currency }: { organizationId: string; currency: string }) {
  const [state, formAction] = useActionState(resetNegotiatedFee, idleState);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Taxa voltou para a padrão");
    if (state.status === "error") toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="currency" value={currency} />
      <SubmitButton variant="ghost" size="sm">
        <RotateCcwIcon />
        Voltar ao padrão
      </SubmitButton>
    </form>
  );
}
