"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { SelectField, TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import type { TaxRegime } from "@/generated/prisma/enums";
import { idleState } from "@/lib/actions/action-state";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import type { TaxSettingsView } from "@/modules/taxes/tax-settings.service";
import { saveTaxSettings } from "./actions";

export function TaxRegimeForm({ settings }: { settings: TaxSettingsView }) {
  const dict = useAppDictionary();
  const t = dict.settings;
  const regimes = Object.keys(t.taxRegimes) as TaxRegime[];
  const [state, formAction] = useActionState(saveTaxSettings, idleState);
  const [regime, setRegime] = useState<TaxRegime>(settings.regime);
  const error = (field: string) => (state.status === "error" ? state.fieldErrors?.[field] : undefined);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? dict.toasts.saved);
  }, [state, dict]);

  const charging = regime !== "NONE";

  return (
    <form action={formAction} className="space-y-4">
      <SelectField
        label={t.regime}
        name="regime"
        value={regime}
        onChange={(event) => setRegime(event.target.value as TaxRegime)}
        hint={t.taxRegimes[regime].hint}
        error={error("regime")}
      >
        {regimes.map((value) => (
          <option key={value} value={value}>
            {t.taxRegimes[value].label}
          </option>
        ))}
      </SelectField>

      {charging && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t.rate}
            name="rate"
            defaultValue={settings.rate}
            inputMode="decimal"
            placeholder="6"
            hint={t.rateHint}
            error={error("rate")}
          />
          {regime === "BR_ISS" && (
            <TextField
              label={t.jurisdiction}
              name="jurisdiction"
              defaultValue={settings.jurisdiction}
              placeholder="São Paulo/SP"
              hint={t.jurisdictionHint}
              error={error("jurisdiction")}
            />
          )}
        </div>
      )}

      {state.status === "error" && !state.fieldErrors && <p className="text-xs text-destructive">{state.message}</p>}

      <SubmitButton>{t.saveRegime}</SubmitButton>
    </form>
  );
}
