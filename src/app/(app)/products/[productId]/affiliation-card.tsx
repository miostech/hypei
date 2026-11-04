"use client";

import { HandshakeIcon, XIcon } from "lucide-react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { CopyLink } from "@/app/(app)/affiliates/copy-link";
import { TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { idleState } from "@/lib/actions/action-state";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import { plural } from "@/lib/i18n/locale";
import { closeAffiliateProgram, openAffiliateProgram } from "../actions";

/**
 * O programa de afiliados do produto: liga, define a comissão e entrega o link de convite.
 *
 * Um formulário só para abrir e editar, porque é a mesma decisão: a comissão que o produto
 * oferece. Fechar fica à parte, ao lado do link, onde ela está olhando o convite que circula.
 */
export function AffiliationCard({
  productId,
  enabled,
  commission,
  inviteUrl,
  affiliateCount,
}: {
  productId: string;
  enabled: boolean;
  commission: string;
  inviteUrl: string | null;
  affiliateCount: number;
}) {
  const dict = useAppDictionary();
  const t = dict.affiliates.program;
  const [state, open] = useActionState(openAffiliateProgram, idleState);
  const [closeState, close] = useActionState(closeAffiliateProgram, idleState);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? dict.toasts.saved);
    if (closeState.status === "success") toast.success(closeState.message ?? dict.toasts.saved);
  }, [state, closeState, dict]);

  const error = state.status === "error" ? (state.fieldErrors?.commission ?? state.message) : undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
          <Badge variant={enabled ? "success" : "outline"}>{enabled ? t.enabled : t.disabled}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={open} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="productId" value={productId} />
          <TextField
            label={t.commission}
            name="commission"
            inputMode="decimal"
            placeholder="30"
            defaultValue={commission}
            required
            error={error}
            className="w-32"
          />
          <SubmitButton>
            <HandshakeIcon />
            {enabled ? t.save : t.enable}
          </SubmitButton>
        </form>
        <p className="text-xs text-muted-foreground">{t.commissionHint}</p>

        {enabled && inviteUrl && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{t.inviteTitle}</span>
              <form action={close}>
                <input type="hidden" name="productId" value={productId} />
                <Button type="submit" variant="ghost" size="sm">
                  <XIcon />
                  {t.disable}
                </Button>
              </form>
            </div>
            <CopyLink url={inviteUrl} label={t.inviteTitle} />
            <p className="text-xs text-muted-foreground">{t.inviteHint}</p>
            {affiliateCount > 0 && (
              <p className="text-xs text-muted-foreground">{plural(dict.locale, affiliateCount, t.affiliated)}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
