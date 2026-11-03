"use server";

import { revalidatePath } from "next/cache";
import { ForbiddenError } from "@/lib/errors";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { plural } from "@/lib/i18n/locale";
import { requirePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";
import { runAction, type ActionState } from "@/server/actions/action-state";

/**
 * Development helper that runs the settlement routine as if the window had elapsed,
 * so PENDING → AVAILABLE can be exercised without waiting D+N. Never enabled in production.
 */
export async function simulateSettlement(): Promise<ActionState> {
  return runAction(async () => {
    if (process.env.APP_ENV === "production") throw new ForbiddenError("Indisponível em produção");
    const { organization } = await requirePermission("finance:read");
    const result = await getServices().settlements.releaseDue({
      now: new Date(Date.now() + 365 * 86_400_000),
      organizationId: organization.id,
    });
    revalidatePath("/finance");
    revalidatePath("/payouts");
    revalidatePath("/dashboard");
    const dict = await getAppDictionary(await appLocale());
    return {
      status: "success",
      message:
        result.processed === 0
          ? dict.finance.noSettlement
          : plural(dict.locale, result.processed, dict.finance.settlementDone),
    };
  });
}
