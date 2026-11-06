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
import { idleState, type ActionState } from "@/lib/actions/action-state";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import { fill } from "@/lib/i18n/locale";

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
  settlesIn,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  products: { id: string; name: string }[];
  defaultValues: OfferFormValues;
  submitLabel: string;
  /** A moeda que a conta de recebimento recebe, para avisar quando a oferta é em outra. */
  settlesIn: string | null;
}) {
  const dict = useAppDictionary();
  const t = dict.offerForm;
  const [state, formAction] = useActionState(action, idleState);
  const [billingType, setBillingType] = useState(defaultValues.billingType);
  const [currency, setCurrency] = useState(defaultValues.currency);
  const fieldError = (field: string) => (state.status === "error" ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? dict.actions.saved);
    if (state.status === "error" && !state.fieldErrors) toast.error(state.message);
  }, [state, dict.actions.saved]);

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-3">
      {defaultValues.id && <input type="hidden" name="id" value={defaultValues.id} />}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t.card.title}</CardTitle>
          <CardDescription>{t.card.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SelectField label={dict.common.product} name="productId" defaultValue={defaultValues.productId} required error={fieldError("productId")}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </SelectField>
          <TextField label={t.name} name="name" defaultValue={defaultValues.name} required error={fieldError("name")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={dict.common.price}
              name="price"
              inputMode="decimal"
              placeholder={t.pricePlaceholder}
              defaultValue={defaultValues.price}
              required
              hint={t.priceHint}
              error={fieldError("price")}
            />
            <SelectField
              label={t.currency}
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              // O saldo nasce na moeda da venda e o saque sai nela: vender em dólar com conta
              // em real é saldo que ela não consegue sacar. Melhor saber antes de publicar.
              hint={settlesIn && settlesIn !== currency ? fill(t.currencySettlement, { currency, account: settlesIn }) : undefined}
              error={fieldError("currency")}
            >
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </SelectField>
          </div>
          <SelectField
            label={t.billingType}
            name="billingType"
            value={billingType}
            onChange={(e) => setBillingType(e.target.value)}
            error={fieldError("billingType")}
          >
            {Object.values(BillingType).map((type) => (
              <option key={type} value={type}>
                {dict.offers.billingTypes[type]}
              </option>
            ))}
          </SelectField>

          {billingType === "SUBSCRIPTION" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label={t.interval} name="billingInterval" defaultValue={defaultValues.billingInterval ?? "MONTH"} error={fieldError("billingInterval")}>
                {Object.values(BillingInterval).map((interval) => (
                  <option key={interval} value={interval}>
                    {dict.offers.billingIntervals[interval]}
                  </option>
                ))}
              </SelectField>
              <TextField label={t.trialDays} name="trialDays" type="number" min={0} max={90} defaultValue={defaultValues.trialDays ?? 0} error={fieldError("trialDays")} />
            </div>
          )}

          {billingType === "INSTALLMENTS" && (
            <TextField
              label={t.installments}
              name="installments"
              type="number"
              min={2}
              max={12}
              defaultValue={defaultValues.installments ?? 12}
              hint={t.installmentsHint}
              error={fieldError("installments")}
            />
          )}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{t.availability.title}</CardTitle>
          <CardDescription>{t.availability.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="active">{t.availability.active}</Label>
            <Switch id="active" name="active" defaultChecked={defaultValues.active} />
          </div>
          {state.status === "error" && !state.fieldErrors && <p className="text-xs text-destructive">{state.message}</p>}
          <SubmitButton className="w-full">{submitLabel}</SubmitButton>
        </CardContent>
      </Card>
    </form>
  );
}
