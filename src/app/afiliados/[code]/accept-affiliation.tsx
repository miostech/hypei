"use client";

import { HandshakeIcon } from "lucide-react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { idleState } from "@/lib/actions/action-state";
import { useAppDictionary } from "@/lib/i18n/app/provider";
import { acceptAffiliation } from "./actions";

/** Confirma a afiliação. A página recarrega já com o link de venda da pessoa. */
export function AcceptAffiliation({ code }: { code: string }) {
  const dict = useAppDictionary();
  const [state, formAction] = useActionState(acceptAffiliation, idleState);

  useEffect(() => {
    if (state.status === "success") toast.success(state.message ?? dict.toasts.saved);
  }, [state, dict]);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="code" value={code} />
      <SubmitButton className="w-full">
        <HandshakeIcon />
        {dict.invite.confirm}
      </SubmitButton>
      {state.status === "error" && <p className="text-center text-xs text-destructive">{state.message}</p>}
    </form>
  );
}
