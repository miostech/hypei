"use client";

import { Loader2Icon, ZapIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import { requestFastSettlement } from "./actions";

/**
 * Pede o recebimento de cartão em 2 dias e mostra a resposta ali mesmo.
 *
 * A verificação acontece no clique, não depois: quem não tem faturamento para liberar recebe
 * a explicação do que falta, em vez de um pedido pendente que ninguém sabe onde foi parar.
 */
export function FastSettlementButton() {
  const t = useAppDictionary().finance.terms;
  const [pending, startTransition] = useTransition();
  const [denied, setDenied] = useState<string | null>(null);

  return (
    <>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await requestFastSettlement();
            if (result.status === "success") toast.success(result.message ?? t.fastGranted);
            if (result.status === "error") setDenied(result.message ?? t.fastDenied);
          })
        }
      >
        {pending ? <Loader2Icon className="animate-spin" /> : <ZapIcon />}
        {pending ? t.fastPending : t.fastAction}
      </Button>

      <Dialog open={denied !== null} onOpenChange={() => setDenied(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.fastTitle}</DialogTitle>
            <DialogDescription className="whitespace-pre-line">{denied}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenied(null)}>
              {t.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
