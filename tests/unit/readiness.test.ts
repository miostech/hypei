import { afterEach, describe, expect, it, vi } from "vitest";

const prismaQuery = vi.fn();
const redisPing = vi.fn();
const mongoCommand = vi.fn();

vi.mock("@/lib/database/postgres/client", () => ({
  getPrisma: () => ({ $queryRaw: prismaQuery }),
}));
vi.mock("@/lib/database/redis/client", () => ({
  getRedis: () => ({ ping: redisPing }),
}));
vi.mock("@/lib/database/mongo/client", () => ({
  getMongoClient: async () => ({ db: () => ({ command: mongoCommand }) }),
}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    MONGODB_DB: "kabrun",
    KEYCLOAK_URL: "https://id.kabrun.test",
    KEYCLOAK_INTERNAL_URL: undefined,
    KEYCLOAK_REALM: "kabrun",
  }),
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

function allHealthy() {
  prismaQuery.mockResolvedValue([{ "?column?": 1 }]);
  redisPing.mockResolvedValue("PONG");
  mongoCommand.mockResolvedValue({ ok: 1 });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GET /api/ready", () => {
  it("returns 200 when every dependency answers", async () => {
    allHealthy();
    const { GET } = await import("@/app/api/ready/route");

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ready");
    expect(body.checks.map((c: { name: string }) => c.name)).toEqual(["postgres", "mongo", "redis", "keycloak"]);
    expect(body.checks.every((c: { ok: boolean }) => c.ok)).toBe(true);
  });

  it("returns 503 and names the dependency that is down", async () => {
    allHealthy();
    redisPing.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.4:6379"));
    const { GET } = await import("@/app/api/ready/route");

    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe("not_ready");
    expect(body.checks).toContainEqual({ name: "redis", ok: false });
    expect(body.checks).toContainEqual({ name: "postgres", ok: true });

    // The endpoint is public: the failure must not carry hosts, ports or driver messages.
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(body)).not.toContain("10.0.0.4");
  });

  it("fails readiness when Keycloak answers with an error status", async () => {
    allHealthy();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    const { GET } = await import("@/app/api/ready/route");

    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.checks).toContainEqual({ name: "keycloak", ok: false });
  });
});
