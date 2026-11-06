"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { TextField } from "@/components/shared/form-field";
import { SubmitButton } from "@/components/shared/submit-button";
import { idleState } from "@/lib/actions/action-state";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import { savePixKey } from "./actions";

export function PixKeyForm({ pixKey }: { pixKey: string | null }) {
  const dict = useAppDictionary();
  const t = dict.settings;
  const [state, formAction] = useActionState(savePixKey, idleState);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? dict.toasts.saved);
  }, [state, dict]);

  return (
    <form action={formAction} className="space-y-4">
      {/*
        A chave aparece inteira: é dela, e é conferindo o que está escrito que ela percebe
        que digitou o CPF errado — mascarar aqui esconderia justamente o erro que importa.
      */}
      <TextField
        // Remonta o campo quando a chave salva muda, para o valor novo entrar no lugar do
        // que ela digitou. Um erro não muda a chave salva, então o que ela digitou fica.
        key={pixKey ?? ""}
        label={t.pixKey}
        name="pixKey"
        defaultValue={pixKey ?? ""}
        placeholder={t.pixKeyPlaceholder}
        autoComplete="off"
        spellCheck={false}
        hint={t.pixKeyHint}
        error={state.status === "error" ? state.fieldErrors?.pixKey : undefined}
      />

      {state.status === "error" && !state.fieldErrors && <p className="text-xs text-destructive">{state.message}</p>}

      <SubmitButton>{t.savePixKey}</SubmitButton>
    </form>
  );
}
