import { describe, expect, it, vi } from "vitest";

/**
 * A fully configured production environment. Each test starts from this and breaks
 * exactly one thing, so the assertion names the rule being exercised.
 */
const PRODUCTION_ENV: Record<string, string> = {
  APP_ENV: "production",
  APP_URL: "https://app.kabrun.com.br",
  SESSION_SECRET: "s".repeat(40),
  DATA_HASH_SECRET: "d".repeat(40),
  DATABASE_URL: "postgresql://user:pass@db:5432/kabrun?schema=public",
  MONGODB_URI: "mongodb://mongo:27017/kabrun",
  REDIS_URL: "redis://redis:6379",
  KEYCLOAK_URL: "https://id.kabrun.com.br",
  KEYCLOAK_CLIENT_SECRET: "a-real-keycloak-secret",
  PAYMENT_PROVIDER: "stripe",
  STRIPE_SECRET_KEY: "sk_live_realkey",
  STRIPE_WEBHOOK_SECRET: "whsec_realsecret",
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "re_real_key",
  STORAGE_PROVIDER: "s3",
  STORAGE_BUCKET: "kabrun-prod",
  STORAGE_REGION: "us-east-1",
  STORAGE_ACCESS_KEY_ID: "AKIAREAL",
  STORAGE_SECRET_ACCESS_KEY: "a-real-storage-secret",
  LOG_LEVEL: "info",
};

/** Loads a fresh copy of the module (getEnv caches) against a controlled environment. */
async function loadEnv(overrides: Record<string, string | undefined> = {}) {
  vi.resetModules();
  const original = process.env;
  process.env = { ...PRODUCTION_ENV, ...overrides } as NodeJS.ProcessEnv;
  try {
    const { getEnv } = await import("@/lib/env");
    return getEnv();
  } finally {
    process.env = original;
  }
}

describe("getEnv", () => {
  it("keeps the Resend and S3 credentials, so the providers can be built", async () => {
    const env = await loadEnv();

    // Regression: these used to be absent from the schema, and Zod dropped them, which made
    // EMAIL_PROVIDER=resend and STORAGE_PROVIDER=s3 impossible to enable at all.
    expect(env.RESEND_API_KEY).toBe("re_real_key");
    expect(env.STORAGE_BUCKET).toBe("kabrun-prod");
    expect(env.STORAGE_ACCESS_KEY_ID).toBe("AKIAREAL");

    const { createEmailProvider } = await import("@/lib/providers/email/email-provider");
    const { createStorageProvider } = await import("@/lib/providers/storage");
    expect(createEmailProvider(env).name).toBe("resend");
    expect(createStorageProvider(env).constructor.name).toBe("S3StorageProvider");
  });

  it("accepts the silent log level used by the test setup", async () => {
    const env = await loadEnv({ LOG_LEVEL: "silent" });
    expect(env.LOG_LEVEL).toBe("silent");
  });

  describe("in production", () => {
    it("refuses the mock payment provider", async () => {
      await expect(loadEnv({ PAYMENT_PROVIDER: "mock" })).rejects.toThrow(/never moves real money/);
    });

    it("refuses mail providers that do not deliver", async () => {
      await expect(loadEnv({ EMAIL_PROVIDER: "preview" })).rejects.toThrow(/does not deliver mail/);
      await expect(loadEnv({ EMAIL_PROVIDER: "console" })).rejects.toThrow(/does not deliver mail/);
    });

    it("refuses uploads on the container disk but allows them to be disabled", async () => {
      await expect(loadEnv({ STORAGE_PROVIDER: "local" })).rejects.toThrow(/loses files on restart/);
      await expect(loadEnv({ STORAGE_PROVIDER: "none" })).resolves.toMatchObject({ STORAGE_PROVIDER: "none" });
    });

    it("refuses a plain http app url", async () => {
      await expect(loadEnv({ APP_URL: "http://app.kabrun.com.br" })).rejects.toThrow(/must use https/);
    });

    it("refuses the secrets from .env.example", async () => {
      await expect(
        loadEnv({ SESSION_SECRET: "change-me-to-a-long-random-string-with-32-plus-chars" }),
      ).rejects.toThrow(/SESSION_SECRET is still the value from .env.example/);
      await expect(loadEnv({ KEYCLOAK_CLIENT_SECRET: "kabrun-web-local-dev-secret" })).rejects.toThrow(
        /KEYCLOAK_CLIENT_SECRET is still the value from .env.example/,
      );
    });

    it("reports every problem at once", async () => {
      await expect(
        loadEnv({ PAYMENT_PROVIDER: "mock", EMAIL_PROVIDER: "console", APP_URL: "http://app.kabrun.com.br" }),
      ).rejects.toThrow(/never moves real money.*does not deliver mail.*must use https/s);
    });
  });

  it("leaves development free to use the local stand-ins", async () => {
    const env = await loadEnv({
      APP_ENV: "development",
      APP_URL: "http://localhost:3100",
      PAYMENT_PROVIDER: "mock",
      EMAIL_PROVIDER: "preview",
      STORAGE_PROVIDER: "local",
      SESSION_SECRET: "change-me-to-a-long-random-string-with-32-plus-chars",
      STRIPE_SECRET_KEY: undefined,
      STRIPE_WEBHOOK_SECRET: undefined,
    });
    expect(env.PAYMENT_PROVIDER).toBe("mock");
    expect(env.STORAGE_PROVIDER).toBe("local");
  });
});
