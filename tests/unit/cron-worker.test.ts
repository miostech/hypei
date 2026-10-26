import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const tick = vi.fn();
let cronSecret: string | undefined = "segredo-do-cron";

vi.mock("@/lib/env", () => ({ getEnv: () => ({ CRON_SECRET: cronSecret }) }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/container", () => ({ getServices: () => ({}) }));
vi.mock("@/workers/tick", () => ({ runWorkerTick: tick }));

const call = async (authorization?: string) => {
  const { GET } = await import("@/app/api/cron/worker/route");
  const headers = new Headers();
  if (authorization !== undefined) headers.set("authorization", authorization);
  return GET(new NextRequest("https://app.kabrun.com.br/api/cron/worker", { headers }));
};

afterEach(() => {
  cronSecret = "segredo-do-cron";
  vi.clearAllMocks();
});

/**
 * Esta rota move dinheiro: é ela que libera o saldo do produtor. Um descuido aqui ou a
 * deixa aberta para qualquer um disparar, ou a fecha para o próprio cron — e os dois
 * passam despercebidos em produção.
 */
describe("GET /api/cron/worker", () => {
  it("roda a passada quando o segredo confere", async () => {
    tick.mockResolvedValue({ retried: 1, published: 2, settled: 3, released: "1500" });

    const response = await call("Bearer segredo-do-cron");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", retried: 1, published: 2, settled: 3 });
    expect(tick).toHaveBeenCalledOnce();
  });

  it("recusa sem header, com segredo errado ou com esquema errado", async () => {
    for (const header of [undefined, "Bearer errado", "segredo-do-cron", "Basic segredo-do-cron"]) {
      const response = await call(header);
      expect(response.status).toBe(401);
    }
    expect(tick).not.toHaveBeenCalled();
  });

  it("falha fechada quando CRON_SECRET não está configurado", async () => {
    cronSecret = undefined;

    const response = await call("Bearer qualquer-coisa");

    expect(response.status).toBe(503);
    expect(tick).not.toHaveBeenCalled();
  });

  it("devolve 500 quando a passada falha, para o cron registrar o erro", async () => {
    tick.mockRejectedValue(new Error("postgres indisponível"));

    const response = await call("Bearer segredo-do-cron");

    expect(response.status).toBe(500);
    // O erro interno não vaza numa rota pública.
    expect(JSON.stringify(await response.json())).not.toContain("postgres");
  });
});
