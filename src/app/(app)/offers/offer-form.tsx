"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { SelectField, TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BillingInterval, BillingType } from "@/generated/prisma/enums";
import { SUPPORTED_CURRENCIES } from "@/lib/money/currency";
import { BILLING_INTERVAL_LABELS, BILLING_TYPE_LABELS } from "@/modules/offers/offer.schemas";
import { idleState, type ActionState } from "@/lib/actions/action-state";

export interface OfferFormValues {
  id?: string;
  productId: string;
  name: string;
  price: string;
  currency: string;
  billingType: string;
  installments?: number;
  billingInterval?: string;
  trialDays?: number;
  active: boolean;
}

export function OfferForm({
  action,
  products,
  defaultValues,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  products: { id: string; name: string }[];
  defaultValues: OfferFormValues;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const [billingType, setBillingType] = useState(defaultValues.billingType);
  const fieldError = (field: string) => (state.status === "error" ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Salvo");
    if (state.status === "error" && !state.fieldErrors) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-3">
      {defaultValues.id && <input type="hidden" name="id" value={defaultValues.id} />}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Oferta</CardTitle>
          <CardDescription>Este é o preço oficial cobrado no checkout.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectField label="Produto" name="productId" defaultValue={defaultValues.productId} required error={fieldError("productId")}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </SelectField>
          <TextField label="Nome da oferta" name="name" defaultValue={defaultValues.name} required error={fieldError("name")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Preço"
              name="price"
              inputMode="decimal"
              placeholder="97,00"
              defaultValue={defaultValues.price}
              required
              hint="Use vírgula ou ponto para os centavos."
              error={fieldError("price")}
            />
            <SelectField label="Moeda" name="currency" defaultValue={defaultValues.currency} error={fieldError("currency")}>
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </SelectField>
          </div>
          <SelectField
            label="Forma de cobrança"
            name="billingType"
            value={billingType}
            onChange={(e) => setBillingType(e.target.value)}
            error={fieldError("billingType")}
          >
            {Object.values(BillingType).map((type) => (
              <option key={type} value={type}>
                {BILLING_TYPE_LABELS[type]}
              </option>
            ))}
          </SelectField>

          {billingType === "SUBSCRIPTION" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Recorrência" name="billingInterval" defaultValue={defaultValues.billingInterval ?? "MONTH"} error={fieldError("billingInterval")}>
                {Object.values(BillingInterval).map((interval) => (
                  <option key={interval} value={interval}>
                    {BILLING_INTERVAL_LABELS[interval]}
                  </option>
                ))}
              </SelectField>
              <TextField label="Dias de teste" name="trialDays" type="number" min={0} max={90} defaultValue={defaultValues.trialDays ?? 0} error={fieldError("trialDays")} />
            </div>
          )}

          {billingType === "INSTALLMENTS" && (
            <TextField
              label="Número de parcelas"
              name="installments"
              type="number"
              min={2}
              max={12}
              defaultValue={defaultValues.installments ?? 12}
              hint="O parcelamento depende do que o provedor de pagamento suporta no país."
              error={fieldError("installments")}
            />
          )}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Disponibilidade</CardTitle>
          <CardDescription>Ofertas inativas somem dos checkouts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="active">Oferta ativa</Label>
            <Switch id="active" name="active" defaultChecked={defaultValues.active} />
          </div>
          {state.status === "error" && !state.fieldErrors && <p className="text-xs text-destructive">{state.message}</p>}
          <SubmitButton className="w-full">{submitLabel}</SubmitButton>
        </CardContent>
      </Card>
    </form>
  );
}
