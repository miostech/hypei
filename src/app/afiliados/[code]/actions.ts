"use server";

import { revalidatePath } from "next/cache";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { normalizeReferralCode } from "@/modules/affiliates/referral";
import { requireUser } from "@/modules/auth/current-user";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

/**
 * A pessoa confirma que quer se afiliar.
 *
 * A comissão cai na conta que ela já tem na Kabrun — a mesma de onde ela vende, se vender.
 * Quem não tem conta nenhuma passa pelo cadastro antes: é dinheiro entrando, e a conta é o
 * que carrega país, moeda e identificação fiscal de quem recebe.
 */
export async function acceptAffiliation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const code = normalizeReferralCode(String(formData.get("code")));
    const user = await requireUser(`/afiliados/${code}`);
    const services = getServices();
    const dict = await getAppDictionary(await appLocale());

    const [membership] = await services.organizations.listForUser(user.id);
    if (!membership) return { status: "error", message: dict.invite.needsAccount };

    await services.affiliates.acceptInvitation({ code, user, payeeOrganizationId: membership.organization.id });
    revalidatePath(`/afiliados/${code}`);
    return { status: "success", message: dict.toasts.affiliationAccepted };
  });
}
