import type { Clock } from "@/lib/clock";
import { logger } from "@/lib/logger";
import { assertSupportedCurrency } from "@/lib/money";
import type { LedgerService } from "@/modules/ledger/ledger.service";
import type { Repositories } from "@/server/repositories";
import type { UnitOfWork } from "@/server/unit-of-work";

export interface ReserveRunResult {
  processed: number;
  released: bigint;
}

/**
 * A reserva de segurança: a parte de cada venda que espera a janela de contestação passar.
 *
 * Ela existe porque os dois prazos não combinam — o produtor recebe em dias e pode sacar no
 * mesmo dia, enquanto o comprador ainda pode contestar a compra por meses. Sem reter nada, o
 * estorno que chega depois do saque vira saldo negativo que ninguém cobra. Quem não dá
 * problema recebe tudo de volta no vencimento; quem dá, paga do próprio dinheiro.
 */
export class ReserveService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly ledger: LedgerService,
    private readonly clock: Clock,
  ) {}

  async releaseDue(options: { now?: Date; organizationId?: string; limit?: number } = {}): Promise<ReserveRunResult> {
    const now = options.now ?? this.clock();
    const due = await this.uow.repos.reserves.findDueForRelease(now, options.limit ?? 500, options.organizationId);
    let released = 0n;
    let processed = 0;
    for (const { id } of due) {
      const amount = await this.release(id);
      if (amount > 0n) processed += 1;
      released += amount;
    }
    if (processed > 0) logger.info({ processed, released: released.toString() }, "reserve release run finished");
    return { processed, released };
  }

  /** Devolve o que sobrou desta reserva ao saldo disponível. Idempotente. */
  async release(reserveId: string): Promise<bigint> {
    return this.uow.transaction(async (repos) => {
      const reserve = await repos.reserves.lock(reserveId);
      if (reserve.status !== "HELD") return 0n;

      const remaining = reserve.amount - reserve.consumedAmount;
      if (remaining <= 0n) {
        // Estorno comeu a reserva inteira: não há o que devolver, só fechar.
        await repos.reserves.update(reserve.id, { status: "USED" });
        return 0n;
      }

      // A reserva nunca adianta o prazo de recebimento: se a venda ainda não liberou, ela
      // espera a próxima passada. Devolver agora colocaria no disponível um dinheiro que o
      // settlement ainda não soltou.
      const payment = reserve.referenceId ? await repos.payments.findById(reserve.referenceId) : null;
      if (!payment?.settledAt) return 0n;

      await this.ledger.post(repos, {
        organizationId: reserve.organizationId,
        idempotencyKey: `reserve:${reserve.id}:released`,
        type: "reserve.released",
        referenceType: "Reserve",
        referenceId: reserve.id,
        paymentId: payment.id,
        currency: assertSupportedCurrency(reserve.currency),
        description: "Reserva de segurança liberada",
        lines: [
          { account: "RESERVES", direction: "DEBIT", amount: remaining },
          { account: "PRODUCER_AVAILABLE", direction: "CREDIT", amount: remaining },
        ],
      });
      await repos.reserves.update(reserve.id, { status: "RELEASED" });
      return remaining;
    });
  }

  /**
   * Quanto desta venda ainda está retido — o que um estorno come antes de tocar no saldo.
   *
   * Devolve as linhas do lançamento já prontas: a parte que sai da reserva e a que sai de
   * onde o dinheiro do produtor estiver. Quem estorna não precisa saber se há reserva.
   */
  static async consume(repos: Repositories, paymentId: string, amount: bigint): Promise<bigint> {
    if (amount <= 0n) return 0n;
    const reserve = await repos.reserves.findHeldForPayment(paymentId);
    if (!reserve) return 0n;
    const remaining = reserve.amount - reserve.consumedAmount;
    const taken = amount > remaining ? remaining : amount;
    if (taken <= 0n) return 0n;
    const consumed = reserve.consumedAmount + taken;
    await repos.reserves.update(reserve.id, {
      consumedAmount: consumed,
      ...(consumed >= reserve.amount ? { status: "USED" as const } : {}),
    });
    return taken;
  }
}
