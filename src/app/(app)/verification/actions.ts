"use server";

import { revalidatePath } from "next/cache";
import { getEnv } from "@/lib/env";
import { isDomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requirePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";

export type VerificationActionResult = { ok: true; url?: string; message?: string } | { ok: false; message: string };

function toFailure(error: unknown, fallback: string): VerificationActionResult {
  if (isDomainError(error)) return { ok: false, message: error.message };
  logger.error({ err: error }, fallback);
  return { ok: false, message: "Não foi possível falar com o provedor de pagamento. Tente de novo em instantes." };
}

/** Opens the provider's hosted verification and says where to send the producer. */
export async function startVerification(): Promise<VerificationActionResult> {
  try {
    const { organization, userId } = await requirePermission("integrations:manage");
    const { url } = await getServices().verification.startVerification(organization.id, userId, getEnv().APP_URL);
    revalidatePath("/verification");
    return { ok: true, url };
  } catch (error) {
    return toFailure(error, "verification start failed");
  }
}

/** Pulls the provider's current decision instead of waiting for the webhook. */
export async function refreshVerification(): Promise<VerificationActionResult> {
  try {
    const { organization } = await requirePermission("organization:read");
    await getServices().verification.refresh(organization.id);
    revalidatePath("/verification");
    revalidatePath("/dashboard");
    return { ok: true, message: "Status atualizado" };
  } catch (error) {
    return toFailure(error, "verification refresh failed");
  }
}
