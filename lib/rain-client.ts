/**
 * Rain API client.
 *
 * ⚠️ UNCONFIRMED, ask a Rain engineer and update here first:
 *   1. Base URL — RAIN_BASE_URL defaults to the sandbox URL seen in public docs
 *      (api-dev.raincards.xyz/v1). Confirm this is what the hackathon actually uses.
 *   2. Auth header shape — defaulting to `Authorization: Bearer <key>`, the common
 *      pattern. If Rain uses `x-api-key` or something else, change buildHeaders() only,
 *      nothing downstream needs to know.
 *   3. Endpoint paths below are inferred from public Rain/Crossmint integration docs
 *      (createRainUserContract, issueRainCard, getRainUserCards, etc.), not from Rain's
 *      own Swagger reference (behind an access code). Confirm paths on site.
 *   4. Whether issue-card supports an exact merchant lock vs category only.
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
    // UNCONFIRMED: swap for `"x-api-key": env("RAIN_API_KEY")` if the engineer says so.
    authorization: `Bearer ${env("RAIN_API_KEY")}`,
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

export async function issueScopedCard(params: IssueCardParams): Promise<ScopedCard> {
  const userId = env("RAIN_USER_ID");
  // UNCONFIRMED path and body shape. Adjust field names once confirmed on site.
  const body = {
    userId,
    limit: { amount: params.limitCents, frequency: "single_use" },
    expiresAt: params.expiresAt,
    ...(params.merchantLock ? { merchantAllowlist: [params.merchantLock] } : {}),
    reference: params.reference,
  };
  const card = await rainFetch<{
    id: string;
    lastFour: string;
    status: string;
    limit: { amount: number };
    expiresAt: string;
  }>("/cards", { method: "POST", body: JSON.stringify(body) });

  return {
    cardId: card.id,
    lastFour: card.lastFour,
    status: card.status === "active" ? "active" : "inactive",
    limitCents: card.limit.amount,
    expiresAt: card.expiresAt,
  };
}

/** Design decision from RETHINK.md: deactivate once the job is done. Confirm the endpoint
 * exists before relying on it in the demo; if it doesn't, this stage is simply skipped. */
export async function revokeCard(cardId: string): Promise<void> {
  await rainFetch(`/cards/${cardId}`, { method: "DELETE" });
}

export async function listCards(): Promise<ScopedCard[]> {
  const userId = env("RAIN_USER_ID");
  const res = await rainFetch<{ cards: Array<{
    id: string; lastFour: string; status: string; limit: { amount: number }; expiresAt: string;
  }> }>(`/users/${userId}/cards`);
  return res.cards.map((c) => ({
    cardId: c.id,
    lastFour: c.lastFour,
    status: c.status === "active" ? "active" : "inactive",
    limitCents: c.limit.amount,
    expiresAt: c.expiresAt,
  }));
}

export { RainApiError };
