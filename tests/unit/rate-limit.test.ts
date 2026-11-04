import { describe, expect, it, vi } from "vitest";
import { InMemoryRateLimiter, ResilientRateLimiter, type RateLimiter } from "@/lib/security/rate-limit";

/** Um limitador que nunca recusa, para provar de qual dos dois a resposta veio. */
const always: RateLimiter = { consume: async () => ({ allowed: true, remaining: 999, resetSeconds: 60 }) };

/** O Redis fora do ar: o `consume` rejeita, que é como a falha chegava na venda. */
const broken: RateLimiter = {
  consume: () => Promise.reject(new Error("ECONNREFUSED")),
};

describe("ResilientRateLimiter", () => {
  it("uses the shared limiter while it answers", async () => {
    const fallback = new InMemoryRateLimiter();
    const spy = vi.spyOn(fallback, "consume");
    const limiter = new ResilientRateLimiter(always, fallback);

    expect(await limiter.consume("checkout:1.2.3.4", 20, 60)).toMatchObject({ allowed: true, remaining: 999 });
    expect(spy).not.toHaveBeenCalled();
  });

  /**
   * O ponto do conserto. Antes, a rejeição subia até o `catch` genérico da action e o
   * comprador recebia "não foi possível iniciar o pagamento": Redis caído, checkout caído.
   */
  it("answers from memory when the shared limiter fails, instead of rejecting", async () => {
    const limiter = new ResilientRateLimiter(broken, new InMemoryRateLimiter());

    await expect(limiter.consume("checkout:1.2.3.4", 20, 60)).resolves.toMatchObject({ allowed: true });
  });

  it("still enforces the limit while degraded, so a coupon cannot be brute-forced freely", async () => {
    const limiter = new ResilientRateLimiter(broken, new InMemoryRateLimiter());

    const results = [];
    for (let attempt = 0; attempt < 12; attempt++) results.push(await limiter.consume("coupon:1.2.3.4", 10, 60));

    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    expect(results.at(-1)).toMatchObject({ allowed: false });
  });

  it("reports every failure, because limits degrading in silence is how nobody notices", async () => {
    const onError = vi.fn();
    const limiter = new ResilientRateLimiter(broken, new InMemoryRateLimiter(), onError);

    await limiter.consume("coupon:1.2.3.4", 10, 60);
    await limiter.consume("coupon:1.2.3.4", 10, 60);

    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it("keeps each key on its own counter", async () => {
    const limiter = new ResilientRateLimiter(broken, new InMemoryRateLimiter());

    for (let attempt = 0; attempt < 10; attempt++) await limiter.consume("coupon:1.1.1.1", 10, 60);

    expect(await limiter.consume("coupon:1.1.1.1", 10, 60)).toMatchObject({ allowed: false });
    expect(await limiter.consume("coupon:2.2.2.2", 10, 60)).toMatchObject({ allowed: true });
  });
});
