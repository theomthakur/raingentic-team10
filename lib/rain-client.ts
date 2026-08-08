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
  // UNCONFIRMED path, likely something like /contracts/:id or /users/contracts/:id.
  return rainFetch(`/contracts/${contractId}`);
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
 * Create a card.
 *
 * Path and response shape are the ones confirmed against the live sandbox and written up
 * in docs/RAIN-API-CONFIRMED.md — `POST /issuing/users/{userId}/cards`, not `/cards`,
 * which 404s. The response uses `last4` and `expirationMonth`/`expirationYear`, not
 * `lastFour` and `expiresAt`.
 *
 * 🔴 The `configuration` object is the remaining unknown. The minimum accepted body is
 * `{ type: "virtual" }`, and it returns an ACTIVE card with NO spend limit and a 2032
 * expiry. We send our intended scope anyway so that the moment a Rain engineer confirms
 * the schema this starts working — but the caller must treat an unscoped response as a
 * failure to scope, because "a card bound to exactly this purchase" is the entire claim.
 */
export async function issueScopedCard(params: IssueCardParams): Promise<ScopedCard> {
  const userId = env("RAIN_USER_ID");
  const body = {
    type: "virtual",
    configuration: {
      currency: "usd",
      spendLimit: params.limitCents,
      spendLimitFrequency: "single_use",
      expiresAt: params.expiresAt,
      ...(params.merchantLock ? { merchantAllowlist: [params.merchantLock] } : {}),
      reference: params.reference,
    },
  };

  const card = await rainFetch<{
    id: string;
    last4: string;
    status: string;
    expirationMonth?: number;
    expirationYear?: number;
    configuration?: { spendLimit?: number };
  }>(`/issuing/users/${userId}/cards`, { method: "POST", body: JSON.stringify(body) });

  // Rain echoed a card back, but did it honour the scope we asked for? If the limit did
  // not stick, saying "scoped card issued" would be false, so refuse to claim it.
  const grantedLimit = card.configuration?.spendLimit;
  if (grantedLimit !== params.limitCents) {
    throw new Error(
      `Card ${card.id} was created but NOT scoped: asked for a ${params.limitCents}c limit, got ${grantedLimit ?? "none"}. Refusing to present this as a scoped card.`
    );
  }

  return {
    cardId: card.id,
    lastFour: card.last4,
    status: card.status === "active" ? "active" : "inactive",
    limitCents: grantedLimit,
    expiresAt:
      card.expirationYear && card.expirationMonth
        ? new Date(Date.UTC(card.expirationYear, card.expirationMonth, 0)).toISOString()
        : params.expiresAt,
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

export async function listCards(): Promise<ScopedCard[]> {
  const res = await rainFetch<{ cards: Array<{
    id: string; lastFour: string; status: string; limit: { amount: number }; expiresAt: string;
  }> }>(`/issuing/cards`);
  return res.cards.map((c) => ({
    cardId: c.id,
    lastFour: c.lastFour,
    status: c.status === "active" ? "active" : "inactive",
    limitCents: c.limit.amount,
    expiresAt: c.expiresAt,
  }));
}

export { RainApiError };
