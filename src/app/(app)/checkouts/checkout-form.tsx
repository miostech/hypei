"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { SelectField, TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { PaymentMethodType } from "@/generated/prisma/enums";
import { PAYMENT_METHOD_LABELS } from "@/modules/payments/payment-method-resolver";
import { idleState, type ActionState } from "@/lib/actions/action-state";

export interface CheckoutFormValues {
  id?: string;
  offerId: string;
  name: string;
  slug: string;
  headline: string;
  description: string;
  accentColor: string;
  logoUrl: string;
  collectPhone: boolean;
  guaranteeDays: number;
  enabledPaymentMethods: PaymentMethodType[];
}

export function CheckoutForm({
  action,
  offers,
  availableMethods,
  defaultValues,
  submitLabel,
  lockedOffer = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  offers: { id: string; label: string }[];
  availableMethods: PaymentMethodType[];
  defaultValues: CheckoutFormValues;
  submitLabel: string;
  lockedOffer?: boolean;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const [accent, setAccent] = useState(defaultValues.accentColor);
  const [headline, setHeadline] = useState(defaultValues.headline);
  const fieldError = (field: string) => (state.status === "error" ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Salvo");
    if (state.status === "error" && !state.fieldErrors) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-3">
      {defaultValues.id && <input type="hidden" name="id" value={defaultValues.id} />}
      {lockedOffer && <input type="hidden" name="offerId" value={defaultValues.offerId} />}

      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Conteúdo</CardTitle>
            <CardDescription>O que o comprador vê na página de pagamento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!lockedOffer && (
              <SelectField label="Oferta" name="offerId" defaultValue={defaultValues.offerId} required error={fieldError("offerId")}>
                {offers.map((offer) => (
                  <option key={offer.id} value={offer.id}>
                    {offer.label}
                  </option>
                ))}
              </SelectField>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Nome interno" name="name" defaultValue={defaultValues.name} required error={fieldError("name")} />
              <TextField
                label="Link do checkout"
                name="slug"
                defaultValue={defaultValues.slug}
                required
                hint="hypei.com/checkout/seu-link"
                error={fieldError("slug")}
                readOnly={Boolean(defaultValues.id)}
              />
            </div>
            <TextField label="Headline" name="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} required error={fieldError("headline")} />
            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" name="description" rows={4} defaultValue={defaultValues.description} maxLength={600} />
            </div>
            <TextField label="Logo (URL)" name="logoUrl" type="url" defaultValue={defaultValues.logoUrl} placeholder="https://…" error={fieldError("logoUrl")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pagamento</CardTitle>
            <CardDescription>
              Selecione os métodos aceitos. A disponibilidade real depende do país, da moeda e da sua conta no provedor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {availableMethods.map((method) => (
              <div key={method} className="flex items-center gap-2">
                <Checkbox
                  id={`method-${method}`}
                  name="enabledPaymentMethods"
                  value={method}
                  defaultChecked={defaultValues.enabledPaymentMethods.includes(method)}
                />
                <Label htmlFor={`method-${method}`} className="font-normal">
                  {PAYMENT_METHOD_LABELS[method]}
                </Label>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Sem nenhum selecionado, todos os métodos disponíveis são exibidos.</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Aparência</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="accentColor">Cor de destaque</Label>
              <div className="flex items-center gap-2">
                <input
                  id="accentColor"
                  name="accentColor"
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-8 w-14 cursor-pointer rounded-lg border bg-transparent"
                />
                <span className="text-sm text-muted-foreground">{accent}</span>
              </div>
            </div>
            <TextField label="Garantia (dias)" name="guaranteeDays" type="number" min={0} max={365} defaultValue={defaultValues.guaranteeDays} />
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="collectPhone">Pedir telefone</Label>
              <Switch id="collectPhone" name="collectPhone" defaultChecked={defaultValues.collectPhone} />
            </div>
            {state.status === "error" && !state.fieldErrors && <p className="text-xs text-destructive">{state.message}</p>}
            <SubmitButton className="w-full">{submitLabel}</SubmitButton>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Prévia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border p-4" style={{ borderTopColor: accent, borderTopWidth: 3 }}>
              <p className="text-sm font-semibold">{headline || "Headline do checkout"}</p>
              <div className="mt-3 h-2 w-3/4 rounded bg-muted" />
              <div className="mt-2 h-2 w-1/2 rounded bg-muted" />
              <div className="mt-4 h-8 rounded-lg" style={{ background: accent }} />
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
