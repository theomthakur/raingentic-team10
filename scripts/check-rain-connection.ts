/**
 * Run this yourself, locally, once the real API key is in .env.local:
 *
 *   npm run test:rain
 *
 * This never needs to be run by or shown to anyone else. It prints only status codes and
 * whether it succeeded, not the response body, so nothing sensitive lands in a terminal
 * you might share a screenshot of.
 */
// Next.js picks up .env.local on its own; a plain tsx script does not, and dotenv's
// default entrypoint only reads `.env`. Load the file the credentials actually live in.
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  console.log("Checking Rain connectivity...");
  console.log(`  base URL: ${process.env.RAIN_BASE_URL ?? "https://api-dev.raincards.xyz/v1 (default)"}`);
  console.log(`  contract: ${process.env.RAIN_COLLATERAL_CONTRACT_ID ?? "MISSING"}`);

  if (!process.env.RAIN_API_KEY) {
    console.error("\n  RAIN_API_KEY is not set. Put it in .env.local (never commit it).");
    process.exit(1);
  }

  const { getContractDetails } = await import("../lib/rain-client");

  try {
    await getContractDetails();
    console.log("\n  ✓ Authenticated call succeeded.");
    process.exit(0);
  } catch (err) {
    console.error(`\n  ✗ Failed: ${(err as Error).message.split("\n")[0]}`);
    console.error("  If this is a 404, the endpoint path in lib/rain-client.ts needs");
    console.error("  updating, ask the Rain engineer for the real path.");
    console.error("  If this is a 401/403, check the auth header shape in buildHeaders().");
    process.exit(1);
  }
}

main();
