/**
 * Rain API client.
 *
 * Confirmed against the live sandbox (see docs/RAIN-API-CONFIRMED.md):
 *   ✅ Base URL `https://api-dev.raincards.xyz/v1`
 *   ✅ Auth is an `api-key` header, NOT an Authorization bearer — the API says so itself
 *      in its 401: "headers is missing required property 'api-key'".
 *   ✅ Cards live under `/issuing`. Creation is POST /issuing/users/{userId}/cards.
 *
 * 🔴 Still unconfirmed, and each one is a question for a Rain engineer:
 *   1. The `configuration` schema for a spend limit and a short expiry. The minimum body
 *      returns an unscoped card with a 2032 expiry, which we refuse to call "scoped".
 *   2. The status enum that deactivates a card — "inactive" returns 400.
 *   3. Whether the collateral contract needs attaching or funding; it 403s today.
 *   4. Whether exact-merchant locking is supported, or only category level.
 *
 * Nothing else in the app should import `fetch` directly against Rain. Change the shape
 * of a request in exactly one place: here.
 */

import { constants, publicEncrypt, randomUUID } from "node:crypto";
import type { ScopedCard } from "./types";

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.local.example to .env.local.`);
  return value;
}

function baseUrl(): string {
  return process.env.RAIN_BASE_URL ?? "https://api-dev.raincards.xyz/v1";
}

function buildHeaders(): HeadersInit {
  return {
    "content-type": "application/json",
    // CONFIRMED by the API itself: a bearer token returns
    //   401 {"message":"headers is missing required property 'api-key'"}
    // so the header is a plain `api-key`, not an Authorization bearer.
    "api-key": env("RAIN_API_KEY"),
  };
}

class RainApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Rain API error ${status}: ${JSON.stringify(body)}`);
    this.name = "RainApiError";
  }
}

async function rainFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...buildHeaders(), ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new RainApiError(res.status, body);
  return body as T;
}

// --- The one call for the "get one authenticated request working" milestone --------------

/**
 * The lightest read available: the team's collateral contract. Good first call because it
 * needs auth to succeed, and needs nothing else (no card, no user lookup) to be meaningful.
 * If this returns 200, credentials and base URL are both confirmed working.
 */
export async function getContractDetails(): Promise<unknown> {
  const contractId = env("RAIN_COLLATERAL_CONTRACT_ID");
  // Confirmed 403 against the sandbox. Kept because the answer to "does the contract need
  // attaching or funding" is a question for a Rain engineer, not a bug to code around —
  // but it must NOT be the connectivity probe. A 403 here says nothing about whether the
  // credentials work, and reading it as "not connected" wasted hours. See checkConnection.
  return rainFetch(`/contracts/${contractId}`);
}

/**
 * Are the credentials actually working?
 *
 * `GET /issuing/users/{id}` is the right probe: it is the cheapest endpoint that requires
 * auth and that this account genuinely has access to. The collateral contract endpoint
 * 403s for a reason unrelated to the key, so using it as a health check reports a red
 * failure on a perfectly good connection — which is exactly what it did.
 */
export async function checkConnection(): Promise<{
  applicationStatus?: string;
  isActive?: boolean;
  contractCount: number;
  cardCount: number;
}> {
  const userId = env("RAIN_USER_ID");
  const user = await rainFetch<{ applicationStatus?: string; isActive?: boolean }>(
    `/issuing/users/${userId}`
  );
  const contracts = await rainFetch<unknown[]>(`/issuing/users/${userId}/contracts`);
  const cards = await listCards();
  return {
    applicationStatus: user.applicationStatus,
    isActive: user.isActive,
    contractCount: Array.isArray(contracts) ? contracts.length : 0,
    cardCount: cards.length,
  };
}

export async function getCreditBalance(): Promise<{
  creditLimit: number;
  spendingPower: number;
  balanceDue: number;
}> {
  const userId = env("RAIN_USER_ID");
  // UNCONFIRMED path.
  return rainFetch(`/users/${userId}/credit-balances`);
}

// --- Card issuance -------------------------------------------------------------------------

export interface IssueCardParams {
  /** Cents. Scope the card to exactly the approved PO amount, never a round number above it. */
  limitCents: number;
  /** ISO date. Keep this short, the card should not outlive the PO it is bound to. */
  expiresAt: string;
  /** Only pass this if the engineer confirms exact-merchant locking is supported. */
  merchantLock?: string;
  /** Used as the idempotency key upstream, see purchase.ts. Not necessarily sent to Rain. */
  reference: string;
}

/**
 * Sandbox RSA public key for session encryption, published in Rain's own docs at
 * /docs/resource-sessionid-keys. Sandbox only — a production key never lives in a repo.
 */
const SESSION_PEM = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCAP192809jZyaw62g/eTzJ3P9H
+RmT88sXUYjQ0K8Bx+rJ83f22+9isKx+lo5UuV8tvOlKwvdDS/pVbzpG7D7NO45c
0zkLOXwDHZkou8fuj8xhDO5Tq3GzcrabNLRLVz3dkx0znfzGOhnY4lkOMIdKxlQb
LuVM/dGDC9UpulF+UwIDAQAB
-----END PUBLIC KEY-----`;

/**
 * The scoped-card endpoint requires a `sessionid` header, and it is not an opaque id —
 * it is a 32-character hex secret, base64'd, then RSA-OAEP encrypted with Rain's public
 * key. A random UUID gets "Failed to Decrypt Session ID, RSA Public key Not Matching".
 *
 * The same secret would decrypt the returned PAN and CVC. We never ask for those and never
 * keep them: the card id and last four are all this system needs, and holding card numbers
 * we have no use for would be indefensible in a product about spending control.
 */
function generateSessionId(): string {
  const secretKey = randomUUID().replace(/-/g, "");
  const secretKeyBase64 = Buffer.from(secretKey, "hex").toString("base64");
  return publicEncrypt(
    { key: SESSION_PEM, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" },
    Buffer.from(secretKeyBase64, "utf-8")
  ).toString("base64");
}

/**
 * Issue a card scoped to one purchase.
 *
 * 🔴 The endpoint that matters is `/issuing/users/{id}/cards/**scoped**`, not `/cards`.
 * The plain endpoint accepts a one-field body and returns an ACTIVE card with no limit and
 * a 2031 expiry — which is why every attempt to scope a card silently produced an unscoped
 * one. The scoped endpoint takes `amountInUSDCents` and Rain enforces it at authorization.
 *
 * Rain grants the requested amount **plus a ~20% authorization buffer** — ask for 4299 and
 * the card comes back limited to 5159, frequency `allTime`. That is normal card behaviour,
 * not a failure to scope: an authorization can legitimately land slightly above the quoted
 * total. So the check below is that the granted limit covers the purchase and stays within
 * a sane margin of it, not that the two numbers match exactly.
 */
export async function issueScopedCard(params: IssueCardParams): Promise<ScopedCard> {
  const userId = env("RAIN_USER_ID");

  const card = await rainFetch<{
    id: string;
    status: string;
    last4: string;
    expirationMonth?: string | number;
    expirationYear?: string | number;
    limit?: { amount?: number; frequency?: string };
  }>(`/issuing/users/${userId}/cards/scoped`, {
    method: "POST",
    headers: { sessionid: generateSessionId() },
    body: JSON.stringify({ amountInUSDCents: params.limitCents }),
  });

  // The create response omits the limit; the card resource carries it. Read it back rather
  // than assume, because "we issued a scoped card" is the whole claim and it should rest on
  // what Rain says the card is, not on what we asked for.
  const stored = await rainFetch<{ limit?: { amount?: number; frequency?: string } }>(
    `/issuing/cards/${card.id}`
  );
  const granted = stored.limit?.amount ?? card.limit?.amount;

  if (typeof granted !== "number" || granted < params.limitCents) {
    throw new Error(
      `Card ${card.id} came back without a usable limit: asked for ${params.limitCents}c, got ${granted ?? "none"}. Refusing to present it as scoped.`
    );
  }
  // A buffer is expected. A limit many times the purchase is not a scoped card.
  if (granted > params.limitCents * 1.5) {
    throw new Error(
      `Card ${card.id} is not meaningfully scoped: asked for ${params.limitCents}c, granted ${granted}c.`
    );
  }

  return {
    cardId: card.id,
    lastFour: card.last4,
    status: card.status === "active" ? "active" : "inactive",
    limitCents: granted,
    expiresAt:
      card.expirationYear && card.expirationMonth
        ? new Date(Date.UTC(Number(card.expirationYear), Number(card.expirationMonth), 0)).toISOString()
        : params.expiresAt,
  };
}

export interface SandboxCardSettlement {
  transactionId: string;
  status: "settled";
  amountCents: number;
  merchantName: string;
  merchantCategoryCode: string;
}

/**
 * Opt-in because this creates a real transaction in Rain's sandbox, not merely an
 * application record. Keeping it separate from card issuance lets a team demonstrate
 * the control plane without filling the sandbox transaction history on every UI test.
 */
export function sandboxSettlementEnabled(): boolean {
  return process.env.RAIN_SIMULATE_SETTLEMENT === "true";
}

/**
 * Exercise a real scoped sandbox card exactly as a merchant would: authorize its exact
 * PO amount, then capture it. A policy refusal never reaches this function because the
 * pipeline calls it only after verification and issuance have both succeeded.
 */
export async function authorizeAndSettleSandboxCard({
  cardId,
  amountCents,
  merchantName,
  merchantCategoryCode,
}: {
  cardId: string;
  amountCents: number;
  merchantName: string;
  merchantCategoryCode: string;
}): Promise<SandboxCardSettlement> {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error(`Sandbox settlement amount must be a positive integer, got ${amountCents}.`);
  }

  const authorization = await rainFetch<{
    transactionId: string;
    status: "authorized" | "declined" | "settled";
    declinedReason?: string;
  }>("/simulate/transactions/authorize", {
    method: "POST",
    body: JSON.stringify({
      cardId,
      amount: amountCents,
      currency: "USD",
      merchantName,
      merchantCategoryCode,
    }),
  });

  if (authorization.status !== "authorized") {
    throw new Error(
      `Rain sandbox authorization did not approve the scoped card: ${authorization.declinedReason ?? authorization.status}.`
    );
  }

  const settlement = await rainFetch<{
    transactionId: string;
    status: "authorized" | "declined" | "settled";
  }>(`/simulate/transactions/${authorization.transactionId}/settle`, {
    method: "POST",
    body: JSON.stringify({ amount: amountCents }),
  });

  if (settlement.status !== "settled") {
    throw new Error(`Rain sandbox capture did not settle: ${settlement.status}.`);
  }
  if (settlement.transactionId !== authorization.transactionId) {
    throw new Error("Rain sandbox returned a different transaction id at settlement.");
  }

  return {
    transactionId: settlement.transactionId,
    status: "settled",
    amountCents,
    merchantName,
    merchantCategoryCode,
  };
}

/** Design decision from RETHINK.md: deactivate once the job is done. Confirm the endpoint
 * exists before relying on it in the demo; if it doesn't, this stage is simply skipped. */
/**
 * Set a card's status. `PATCH /issuing/cards/{id}` is confirmed to exist against the live
 * sandbox — `DELETE /cards/{id}`, which this used to call, returns 404.
 *
 * 🔴 The accepted status value is NOT yet confirmed: `"inactive"` returns 400. Ask a Rain
 * engineer for the enum and set `RAIN_CARD_INACTIVE_STATUS` in `.env.local`.
 */
export async function setCardStatus(cardId: string, status: string): Promise<void> {
  await rainFetch(`/issuing/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/**
 * List the cards on this account.
 *
 * The response is a bare array, and the fields are `last4` and `configuration` — not the
 * `{ cards: [...] }` envelope with `lastFour` and `limit.amount` this used to assume. That
 * shape was never exercised, so it would have thrown the first time anything called it.
 */
export async function listCards(): Promise<ScopedCard[]> {
  const res = await rainFetch<
    Array<{
      id: string;
      last4: string;
      status: string;
      expirationMonth?: number;
      expirationYear?: number;
      configuration?: { spendLimit?: number };
    }>
  >(`/issuing/cards`);
  const rows = Array.isArray(res) ? res : [];
  return rows.map((c) => ({
    cardId: c.id,
    lastFour: c.last4,
    status: c.status === "active" ? "active" : "inactive",
    // No limit echoed back is the finding, not a parse failure: the sandbox drops it.
    limitCents: c.configuration?.spendLimit ?? 0,
    expiresAt:
      c.expirationYear && c.expirationMonth
        ? new Date(Date.UTC(c.expirationYear, c.expirationMonth, 0)).toISOString()
        : "",
  }));
}

export { RainApiError };
