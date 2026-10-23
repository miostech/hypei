import "server-only";
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 chars"),
  DATA_HASH_SECRET: z.string().min(32, "DATA_HASH_SECRET must be at least 32 chars"),

  DATABASE_URL: z.string().min(1),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().default("kabrun"),
  REDIS_URL: z.string().min(1),

  KEYCLOAK_URL: z.string().url(),
  KEYCLOAK_INTERNAL_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  KEYCLOAK_REALM: z.string().default("kabrun"),
  KEYCLOAK_CLIENT_ID: z.string().default("kabrun-web"),
  KEYCLOAK_CLIENT_SECRET: z.string().min(1),

  PAYMENT_PROVIDER: z.enum(["stripe", "mock"]).default("mock"),
  STRIPE_SECRET_KEY: optionalString,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_CONNECT_CLIENT_ID: optionalString,
  STRIPE_API_VERSION: optionalString,
  MOCK_WEBHOOK_SECRET: z.string().default("mock-webhook-local-dev-secret"),
  MOCK_PROCESSOR_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(400),

  STORAGE_PROVIDER: z.enum(["local", "s3", "r2", "minio", "none"]).default("none"),
  STORAGE_LOCAL_DIR: z.string().default(".storage"),
  // Credentials for the s3/r2/minio providers. They must be part of the schema: `getEnv()`
  // returns the parsed object, and Zod drops every key the schema does not declare.
  STORAGE_BUCKET: optionalString,
  STORAGE_REGION: optionalString,
  STORAGE_ENDPOINT: optionalString,
  STORAGE_ACCESS_KEY_ID: optionalString,
  STORAGE_SECRET_ACCESS_KEY: optionalString,
  EMAIL_PROVIDER: z.enum(["console", "preview", "resend", "ses", "postmark"]).default("console"),
  EMAIL_PREVIEW_DIR: z.string().default(".mail"),
  EMAIL_FROM: z.string().default("Kabrun <no-reply@kabrun.local>"),
  RESEND_API_KEY: optionalString,
  QUEUE_DRIVER: z.enum(["memory", "bullmq", "redis-streams"]).default("memory"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

/** Secrets shipped in `.env.example`; a real deployment must never run with them. */
const EXAMPLE_SECRETS = new Set([
  "change-me-to-a-long-random-string-with-32-plus-chars",
  "change-me-to-another-long-random-string-32-plus",
  "kabrun-web-local-dev-secret",
]);

/**
 * Refuses to boot a production deployment that is still wired to development stand-ins:
 * mock money, mail that never leaves the box, uploads on the container disk, plain HTTP,
 * or the example secrets. Each of these looks healthy at runtime and silently loses data.
 */
function assertProductionReady(env: Env): void {
  const problems: string[] = [];

  if (env.PAYMENT_PROVIDER === "mock") {
    problems.push("PAYMENT_PROVIDER=mock never moves real money");
  }
  if (env.EMAIL_PROVIDER === "console" || env.EMAIL_PROVIDER === "preview") {
    problems.push(`EMAIL_PROVIDER=${env.EMAIL_PROVIDER} does not deliver mail`);
  }
  if (env.STORAGE_PROVIDER === "local") {
    problems.push(
      "STORAGE_PROVIDER=local writes to the container disk and loses files on restart (use s3/r2/minio, or none to disable uploads)",
    );
  }
  if (!env.APP_URL.startsWith("https://")) {
    problems.push("APP_URL must use https, otherwise the session cookie is never sent");
  }
  for (const key of ["SESSION_SECRET", "DATA_HASH_SECRET", "KEYCLOAK_CLIENT_SECRET"] as const) {
    if (EXAMPLE_SECRETS.has(env[key])) problems.push(`${key} is still the value from .env.example`);
  }

  if (problems.length > 0) {
    throw new Error(`APP_ENV=production refuses these settings: ${problems.join("; ")}`);
  }
}

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;
  if (env.PAYMENT_PROVIDER === "stripe") {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("PAYMENT_PROVIDER=stripe requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET");
    }
    if (env.APP_ENV !== "production" && env.STRIPE_SECRET_KEY.startsWith("sk_live_")) {
      throw new Error("Live Stripe keys are not allowed outside production");
    }
  }
  if (env.APP_ENV === "production") assertProductionReady(env);
  cached = env;
  return env;
}
