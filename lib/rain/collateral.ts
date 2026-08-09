/**
 * Rain sandbox collateral funding.
 *
 * Collateral is the pot standing behind issued cards. Without it a card exists but has no
 * spending power, which is a confusing failure to debug, the card looks fine and the
 * authorization fails. Funding it is therefore worth doing explicitly rather than leaving
 * as folklore in someone's terminal history.
 *
 * **Sandbox only.** `POST /simulate/collateral/fund` triggers a deposit *exactly as if* an
 * on-chain transfer had occurred. No chain transaction is executed and no real value
 * moves. Rain's own documentation is unambiguous about this and so is the wording here,
 * because "we funded the collateral" is precisely the sort of phrase that sounds like real
 * treasury movement when read quickly.
 *
 * Contract, from the OpenAPI spec:
 *   contractId  uuid, required, must belong to your tenant
 *   currency    "rusd" only
 *   amount      integer, minimum 0, in cents (10000 = $100.00)
 *   → 200 { transactionId }
 *
 * Docs: https://rain-sandbox-trial.mintlify.site/reference/simulate/simulate-collateral-funding
 */

function baseUrl(): string {
  return process.env.RAIN_BASE_URL ?? "https://api-dev.raincards.xyz/v1";
}

/** Rain currently supports exactly one collateral currency. */
export const COLLATERAL_CURRENCY = "rusd" as const;

/**
 * An upper bound of our own, not Rain's.
 *
 * The spec's only limit is `minimum: 0`, so a typo of one extra zero is accepted happily
 * and quietly distorts every budget figure on screen afterwards. A sandbox that cannot be
 * hurt is still a demo that can be embarrassed.
 */
export const MAX_FUND_CENTS = 100_000_000; // $1,000,000

export class CollateralError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown
  ) {
    super(`Rain collateral error ${status}: ${JSON.stringify(body)}`);
    this.name = "CollateralError";
  }
}

export type CollateralConfig =
  | { configured: true; contractId: string }
  | { configured: false; reason: string };

export function readCollateralConfig(): CollateralConfig {
  if (!process.env.RAIN_API_KEY) {
    return { configured: false, reason: "RAIN_API_KEY is not set." };
  }
  const contractId = process.env.RAIN_COLLATERAL_CONTRACT_ID?.trim();
  if (!contractId) {
    return {
      configured: false,
      reason:
        "RAIN_COLLATERAL_CONTRACT_ID is not set. It is on the team credentials sheet; " +
        "this endpoint will not guess a contract belonging to someone else.",
    };
  }
  return { configured: true, contractId };
}

export type AmountCheck =
  | { ok: true; amountCents: number }
  | { ok: false; error: string };

/**
 * Validate the amount before spending a call on it.
 *
 * Cents, integer, positive. A decimal is rejected rather than rounded: silently turning
 * 100.5 into 100 or 101 is the kind of helpfulness that loses money in a real ledger, and
 * the caller should say what it means.
 */
export function validateFundAmount(input: unknown): AmountCheck {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return { ok: false, error: "amountCents must be a number of cents, for example 10000 for $100.00." };
  }
  if (!Number.isInteger(input)) {
    return { ok: false, error: "amountCents must be a whole number of cents, not a decimal." };
  }
  if (input <= 0) {
    return { ok: false, error: "amountCents must be greater than zero." };
  }
  if (input > MAX_FUND_CENTS) {
    return {
      ok: false,
      error: `amountCents is capped at ${MAX_FUND_CENTS} ($${MAX_FUND_CENTS / 100}) to catch a mistyped zero.`,
    };
  }
  return { ok: true, amountCents: input };
}

export interface CollateralFundResult {
  /** Rain's correlation id for the simulation. The only field the spec guarantees. */
  transactionId: string;
}

/**
 * Fund the configured collateral contract in the sandbox.
 *
 * Returns only on a real success. A non-2xx throws, and the caller must not report a
 * funded balance on anything else: the whole reason this module exists is that "the
 * collateral is funded" has to be a fact rather than an assumption.
 */
export async function fundCollateral(params: {
  contractId: string;
  amountCents: number;
}): Promise<CollateralFundResult> {
  const apiKey = process.env.RAIN_API_KEY;
  if (!apiKey) throw new CollateralError(0, "RAIN_API_KEY is not set.");

  const res = await fetch(`${baseUrl()}/simulate/collateral/fund`, {
    method: "POST",
    headers: { "content-type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      contractId: params.contractId,
      currency: COLLATERAL_CURRENCY,
      amount: params.amountCents,
    }),
  });

  const body = (await res.json().catch(() => null)) as { transactionId?: string } | null;
  if (!res.ok) throw new CollateralError(res.status, body);

  // Rain has answered 202 with only `{ success: true }` in practice, so a missing
  // transactionId is not a failure. But it must not be invented either.
  return { transactionId: body?.transactionId ?? "" };
}
