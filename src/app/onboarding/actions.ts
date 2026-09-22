"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireUser } from "@/modules/auth/current-user";
import { cookieOptions, ORGANIZATION_COOKIE } from "@/modules/auth/session-token";
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
    return { status: "success", message: "Organização criada" };
  });

  if (organizationId) {
    const store = await cookies();
    store.set(ORGANIZATION_COOKIE, organizationId, cookieOptions(60 * 60 * 24 * 30));
    revalidatePath("/", "layout");
    redirect("/dashboard?welcome=1");
  }
  return result;
}
