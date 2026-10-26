"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { SelectField, TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import type { TaxRegime } from "@/generated/prisma/enums";
import { idleState } from "@/lib/actions/action-state";
import { TAX_REGIME_HINTS, TAX_REGIME_LABELS } from "@/modules/taxes/tax.schemas";
import type { TaxSettingsView } from "@/modules/taxes/tax-settings.service";
import { saveTaxSettings } from "./actions";

const REGIMES = Object.keys(TAX_REGIME_LABELS) as TaxRegime[];

export function TaxRegimeForm({ settings }: { settings: TaxSettingsView }) {
  const [state, formAction] = useActionState(saveTaxSettings, idleState);
  const [regime, setRegime] = useState<TaxRegime>(settings.regime);
  const error = (field: string) => (state.status === "error" ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? "Salvo");
  }, [state]);

  const charging = regime !== "NONE";

  return (
    <form action={formAction} className="space-y-4">
      <SelectField
        label="Regime"
        name="regime"
        value={regime}
        onChange={(event) => setRegime(event.target.value as TaxRegime)}
        hint={TAX_REGIME_HINTS[regime]}
        error={error("regime")}
      >
        {REGIMES.map((value) => (
          <option key={value} value={value}>
            {TAX_REGIME_LABELS[value]}
          </option>
        ))}
      </SelectField>

      {charging && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Alíquota (%)"
            name="rate"
            defaultValue={settings.rate}
            inputMode="decimal"
            placeholder="6"
            hint="Já embutida no preço que você anuncia."
            error={error("rate")}
          />
          {regime === "BR_ISS" && (
            <TextField
              label="Município"
              name="jurisdiction"
              defaultValue={settings.jurisdiction}
              placeholder="São Paulo/SP"
              hint="Aparece no detalhamento da venda."
              error={error("jurisdiction")}
            />
          )}
        </div>
      )}

      {state.status === "error" && !state.fieldErrors && <p className="text-xs text-destructive">{state.message}</p>}

      <SubmitButton>Salvar regime</SubmitButton>
    </form>
  );
}
