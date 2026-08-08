/**
 * Read-only Rain account inspector.
 *
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/rain-explore.ts status
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/rain-explore.ts cards
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/rain-explore.ts map
 *
 * GETs only. Nothing here creates, changes or spends anything — writes belong in the app,
 * behind a passing verify(). Prints operational fields only: never the API key, and never
 * the user's name, email or address.
 */
import "dotenv/config";

const BASE = process.env.RAIN_BASE_URL ?? "https://api-dev.raincards.xyz/v1";
const KEY = process.env.RAIN_API_KEY;
const USER = process.env.RAIN_USER_ID;

if (!KEY) {
  console.error("RAIN_API_KEY is not set. Put it in .env.local — never commit it.");
  process.exit(1);
}

// Confirmed against the live sandbox: the header is `api-key`, not an Authorization
// bearer. A bearer returns 401 "headers is missing required property 'api-key'".
const headers = { "content-type": "application/json", "api-key": KEY };

const get = async (path: string) => {
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status, body: await res.json().catch(() => null) };
};

async function status() {
  const { body: u } = await get(`/issuing/users/${USER}`);
  const user = u as Record<string, unknown> | null;
  console.log("account");
  console.log("  applicationStatus :", user?.applicationStatus);
  console.log("  isActive          :", user?.isActive);
  console.log("  termsAccepted     :", user?.isTermsOfServiceAccepted);

  const { body: contracts } = await get(`/issuing/users/${USER}/contracts`);
  const { body: companies } = await get(`/issuing/companies`);
  const n = (x: unknown) => (Array.isArray(x) ? x.length : "?");
  console.log("  collateral contracts:", n(contracts));
  console.log("  companies           :", n(companies));

  if (Array.isArray(contracts) && contracts.length === 0) {
    console.log("\n  ⚠ No collateral contract is linked to this user, so an issued card");
    console.log("    has no spending power behind it. Ask a Rain engineer whether the");
    console.log("    contract on the credentials sheet needs attaching or funding.");
  }
}

async function cards() {
  const { body } = await get("/issuing/cards");
  const list = Array.isArray(body) ? body : [];
  console.log(`${list.length} card(s)\n`);
  for (const c of list as Record<string, unknown>[]) {
    console.log(`  ${c.id}`);
    console.log(`    status  ${c.status}   last4 ${c.last4}   expires ${c.expirationMonth}/${c.expirationYear}`);
    console.log(`    config  ${JSON.stringify(c.configuration)}`);
  }
}

/** The routes confirmed to exist, so nobody has to rediscover them. */
async function map() {
  const paths = [
    "/issuing/cards",
    "/issuing/users",
    `/issuing/users/${USER}`,
    `/issuing/users/${USER}/contracts`,
    "/issuing/transactions",
    "/issuing/companies",
  ];
  for (const p of paths) {
    const { status: code, body } = await get(p);
    const shape = Array.isArray(body)
      ? `array[${body.length}]`
      : body && typeof body === "object"
        ? `{${Object.keys(body).slice(0, 6).join(", ")}}`
        : typeof body;
    console.log(`${code === 200 ? "✓" : " "} ${String(code).padEnd(4)} ${p.replace(String(USER), "<userId>").padEnd(42)} ${shape}`);
  }
}

const cmd = process.argv[2] ?? "status";
const commands: Record<string, () => Promise<void>> = { status, cards, map };
if (!commands[cmd]) {
  console.error(`unknown command "${cmd}" — try: status | cards | map`);
  process.exit(1);
}
commands[cmd]();
