import "server-only";
import { ZodError } from "zod";
import { isDomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ActionState } from "@/lib/actions/action-state";

export type { ActionState };
export { idleState } from "@/lib/actions/action-state";

/**
 * Maps thrown errors to a user-facing ActionState. Validation and domain errors keep
 * their message; anything else is logged and returned as a generic failure.
 */
export function toActionError(error: unknown): ActionState {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Verifique os campos destacados.", fieldErrors };
  }
  if (isDomainError(error)) {
    const field = typeof error.details?.field === "string" ? error.details.field : undefined;
    return { status: "error", message: error.message, fieldErrors: field ? { [field]: error.message } : undefined };
  }
  logger.error({ err: error }, "unhandled server action error");
  return { status: "error", message: "Não foi possível concluir a ação. Tente novamente." };
}

/** `redirect()` throws by design in Next.js — it must never be swallowed by a catch. */
export function isRedirectError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT") === true;
}

export async function runAction(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return toActionError(error);
  }
}
