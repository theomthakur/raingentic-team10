/**
 * Prove the scoped-card path end to end against the sandbox.
 *
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/try-scoped-card.ts
 *
 * The starter kit named an endpoint we had never called: `/issuing/users/{id}/cards/scoped`,
 * which takes `amountInUSDCents` and requires an RSA-encrypted `sessionid` header. We had
 * been calling the plain `/cards` endpoint, which accepts a one-field body and hands back
 * an unscoped card — which is why the limit never stuck.
 *
 * Prints operational fields only. Never the API key, never a decrypted PAN.
 */
import crypto from "crypto";

/** Sandbox RSA public key, from the docs' resource-sessionid-keys page. */
const SANDBOX_PEM = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCAP192809jZyaw62g/eTzJ3P9H
+RmT88sXUYjQ0K8Bx+rJ83f22+9isKx+lo5UuV8tvOlKwvdDS/pVbzpG7D7NO45c
0zkLOXwDHZkou8fuj8xhDO5Tq3GzcrabNLRLVz3dkx0znfzGOhnY4lkOMIdKxlQb
LuVM/dGDC9UpulF+UwIDAQAB
-----END PUBLIC KEY-----`;

function generateSessionId(pem: string) {
  const secretKey = crypto.randomUUID().replace(/-/g, "");
  const secretKeyBase64 = Buffer.from(secretKey, "hex").toString("base64");
  const sessionId = crypto
    .publicEncrypt(
      { key: pem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" },
      Buffer.from(secretKeyBase64, "utf-8")
    )
    .toString("base64");
  return { secretKey, sessionId };
}

async function main() {
  const base = process.env.RAIN_BASE_URL ?? "https://api-dev.raincards.xyz/v1";
  const key = process.env.RAIN_API_KEY;
  const userId = process.env.RAIN_USER_ID;
  if (!key || !userId) throw new Error("RAIN_API_KEY and RAIN_USER_ID must be set.");

  const { sessionId } = generateSessionId(SANDBOX_PEM);
  const amountInUSDCents = 4299;

  const res = await fetch(`${base}/issuing/users/${userId}/cards/scoped`, {
    method: "POST",
    headers: { "content-type": "application/json", "api-key": key, sessionid: sessionId },
    body: JSON.stringify({ amountInUSDCents }),
  });

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  console.log("status:", res.status);
  if (!res.ok) {
    console.log("body  :", JSON.stringify(body));
    process.exit(1);
  }

  // Print the scope, not the card details.
  const safe = (k: string) => JSON.stringify((body ?? {})[k]);
  console.log("  id           :", safe("id"));
  console.log("  status       :", safe("status"));
  console.log("  last4        :", safe("last4"));
  console.log("  expiry       :", safe("expirationMonth"), "/", safe("expirationYear"));
  console.log("  limit        :", safe("limit"), safe("amountInUSDCents"), safe("spendLimit"));
  console.log("  configuration:", JSON.stringify((body ?? {}).configuration));
  console.log();
  console.log("  asked for a limit of", amountInUSDCents, "cents — did it stick?");
}

main().catch((e) => {
  console.error(String(e).slice(0, 300));
  process.exit(1);
});
