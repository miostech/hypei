import { NextResponse } from "next/server";
import { getMongoClient } from "@/lib/database/mongo/client";
import { getPrisma } from "@/lib/database/postgres/client";
import { getRedis } from "@/lib/database/redis/client";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Readiness probe: tells the load balancer whether this instance can serve traffic.
 * Unlike `/api/health` (liveness), it touches every dependency the app cannot work without.
 *
 * The body never carries the underlying error — this endpoint is publicly reachable, and a
 * connection failure message leaks hosts and credentials. Details go to the log instead.
 */
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 3_000;

interface Check {
  name: string;
  ok: boolean;
}

async function check(name: string, run: (signal: AbortSignal) => Promise<unknown>): Promise<Check> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await Promise.race([
      run(controller.signal),
      new Promise((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(new Error(`${name} timed out after ${TIMEOUT_MS}ms`)));
      }),
    ]);
    return { name, ok: true };
  } catch (err) {
    logger.warn({ err, dependency: name }, "readiness check failed");
    return { name, ok: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const env = getEnv();
  const keycloakBase = env.KEYCLOAK_INTERNAL_URL ?? env.KEYCLOAK_URL;

  const checks = await Promise.all([
    check("postgres", () => getPrisma().$queryRaw`SELECT 1`),
    check("mongo", async () => (await getMongoClient()).db(env.MONGODB_DB).command({ ping: 1 })),
    check("redis", () => getRedis().ping()),
    check("keycloak", async (signal) => {
      const res = await fetch(`${keycloakBase}/realms/${env.KEYCLOAK_REALM}/.well-known/openid-configuration`, {
        signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`keycloak responded ${res.status}`);
    }),
  ]);

  const ready = checks.every((c) => c.ok);
  return NextResponse.json(
    { status: ready ? "ready" : "not_ready", checks },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
