import "dotenv/config";
import { getServices } from "../src/server/container";

/**
 * Runs the settlement routine once (PENDING → AVAILABLE).
 * `--simulate` pretends the settlement window has already elapsed, for local development.
 */
async function main() {
  const simulate = process.argv.includes("--simulate");
  const now = simulate ? new Date(Date.now() + 365 * 86_400_000) : new Date();
  const result = await getServices().settlements.releaseDue({ now });
  console.log(`✔ settlement: ${result.processed} payment(s), ${result.released} minor units released${simulate ? " (simulated window)" : ""}`);
  process.exit(0);
}

void main();
