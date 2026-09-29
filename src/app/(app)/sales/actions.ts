"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { assertSupportedCurrency, parseDecimalToMinorUnits } from "@/lib/money";
import { ValidationError } from "@/lib/errors";
import { requirePermission } from "@/modules/organizations/current-organization";
import { refundInputSchema } from "@/modules/refunds/refund.schemas";
import { runAction, type ActionState } from "@/server/actions/action-state";
import { getServices } from "@/server/container";

/**
 * Refunds money to the buyer. The amount is resolved server-side from the payment,
 * so a tampered form can never refund more than what is still refundable.
 */
export async function requestRefund(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { organization, userId } = await requirePermission("refunds:create");
    const input = refundInputSchema.parse({
      paymentId: formData.get("paymentId"),
      scope: formData.get("scope"),
      amount: formData.get("amount") || undefined,
      reason: formData.get("reason") || undefined,
    });

    const services = getServices();
    const payment = await services.uow.repos.payments.findForOrganization(organization.id, input.paymentId);
    if (!payment) throw new ValidationError("Pagamento não encontrado");

    const refundable = payment.amount - payment.refundedAmount;
    const currency = assertSupportedCurrency(payment.currency);
    const amount = input.scope === "full" ? refundable : parseDecimalToMinorUnits(input.amount ?? "0", currency);

    if (amount <= 0n) throw new ValidationError("Informe um valor maior que zero", { field: "amount" });
    if (amount > refundable) {
      throw new ValidationError("Valor acima do que ainda pode ser reembolsado", { field: "amount" });
    }

    await services.refunds.request({
      organizationId: organization.id,
      paymentId: payment.id,
      amount,
      reason: input.reason,
      // One key per submission: a double click reuses it and never refunds twice.
      idempotencyKey: String(formData.get("idempotencyKey") || randomUUID()),
      userId,
    });

    revalidatePath("/sales");
    revalidatePath(`/sales/${payment.orderId}`);
    revalidatePath("/refunds");
    return { status: "success", message: "Reembolso solicitado" };
  });
}
