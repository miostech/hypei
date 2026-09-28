import "dotenv/config";
import { execSync } from "node:child_process";

/** Applies migrations to the dedicated test database before the suite runs. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://ripay:ripay@localhost:5432/ripay_test?schema=public";
  if (!url.includes("_test")) throw new Error("Refusing to run tests against a non-test database");
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url },
  });
}
