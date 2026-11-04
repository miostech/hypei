"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { requireUser } from "@/modules/auth/current-user";
import { cookieOptions, ORGANIZATION_COOKIE, safeReturnTo } from "@/modules/auth/session-token";
import { onboardingSchema } from "@/modules/organizations/organization.schemas";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

export async function completeOnboarding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let organizationId: string | undefined;

  const result = await runAction(async () => {
    const user = await requireUser("/onboarding");
    const input = onboardingSchema.parse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      country: formData.get("country"),
      businessType: formData.get("businessType"),
      currency: formData.get("currency"),
      taxIdType: formData.get("taxIdType"),
      taxId: formData.get("taxId"),
      legalName: formData.get("legalName") ?? "",
      website: formData.get("website") ?? "",
      supportEmail: formData.get("supportEmail"),
    });

    const organization = await getServices().organizations.onboard(user, input);
    organizationId = organization.id;
    return { status: "success", message: (await getAppDictionary(await appLocale())).toasts.organizationCreated };
  });

  if (organizationId) {
    const store = await cookies();
    store.set(ORGANIZATION_COOKIE, organizationId, cookieOptions(60 * 60 * 24 * 30));
    revalidatePath("/", "layout");
    // `safeReturnTo` recusa destino absoluto: o valor vem da URL, e um convite de afiliação
    // não pode virar um redirecionamento para fora da Kabrun.
    redirect(safeReturnTo(formData.get("returnTo")?.toString(), "/dashboard?welcome=1") as Route);
  }
  return result;
}
