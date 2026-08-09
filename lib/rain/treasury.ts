import { createHash } from "node:crypto";
import {
  MINIMUM_TRANSFER_USD,
  type PaymentRoute,
  type TransferSimulation,
  getPaymentRoute,
  readConfig,
  simulateTransfer,
  validateAmount,
} from "./payment-routes";

/**
 * Conditional treasury payout — a treasury movement that has to cite the rule allowing it.
 *
 * This is the treasury-side counterpart to the scoped card, and the two are deliberately
 * kept apart. A supplier is paid by a card bound to a verified purchase order; treasury is
 * moved along a configured payment route. They share no code path and no wording, because
 * presenting one as the other would be a fake checkout. Nothing here is reachable from the
 * purchase pipeline, and nothing here issues, funds, or touches a card.
 *
 * ## What makes it conditional rather than just a transfer
 *
 * A payout cannot be requested without naming *why*: a policy reference and a purpose are
 * required fields, not optional metadata. Those are hashed into a canonical authorization
 * digest before the rail is touched, and the digest is what gets used as the idempotency
 * key. Two consequences fall out of that, and both are the point:
 *
 *  - A payout with no stated authority is rejected at validation, before any network call.
 *  - Replaying the same authorization is the *same* payout to Rain, not a second one. The
 *    condition is therefore load-bearing rather than decorative — change the policy
 *    reference and it is a different payout; keep it and a double-submit is deduplicated.
 *
 * The digest is reported back as evidence, alongside the exact canonical string it was
 * computed over, so a reader can recompute it rather than take our word for it. That is the
 * same stance as the rest of the project: the model may propose, deterministic code decides,
 * and the decision is checkable afterwards.
 *
 * ## What this does not claim
 *
 * Rain's sandbox. `POST /simulate/payment-routes` triggers a transfer *as if* a deposit had
 * arrived, and answers 202 — accepted and processing. Accepted is not settled. No real
 * funds move, no bank account is debited, and no cross-border settlement occurs. The result
 * type has no field capable of saying otherwise, which is on purpose: `settled` is a literal
 * `false`, so no future edit can flip it by accident.
 *
 * Docs: https://rain-sandbox-trial.mintlify.site/docs/payment-routes
 *       https://rain-sandbox-trial.mintlify.site/docs/simulating-transactions/transfer-transactions
 */

export { MINIMUM_TRANSFER_USD };

/** Rejected before the rail is touched, so a bad request costs nothing. */
export const MAX_PURPOSE_LENGTH = 140;
export const MIN_PURPOSE_LENGTH = 3;

/**
 * A policy reference is an identifier, not prose — it should point at a rule that exists.
 * Rain also uses this value as an idempotency key via the digest, so control characters and
 * unbounded length are not merely untidy.
 */
const POLICY_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,63}$/;

export interface PayoutRequest {
  amountUsd: string;
  /** Human-readable: what this payout is for. */
  purpose: string;
  /** Machine-readable: the rule that permits it, e.g. `treasury.rebalance.v2`. */
  policyRef: string;
}

export type PayoutRequestCheck =
  | { ok: true; request: PayoutRequest }
  | { ok: false; error: string };

/**
 * Strict validation of the whole request, amount included.
 *
 * The amount rules are Rain's own and are reused rather than restated: a decimal string in
 * major units, no currency symbols, no commas, at least the $2 floor. A JavaScript number is
 * rejected outright — formatting one here would put float rounding into a money value, and
 * the caller should say what it means instead.
 */
export function validatePayoutRequest(input: unknown): PayoutRequestCheck {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const body = input as Record<string, unknown>;

  const amount = validateAmount(body.amountUsd);
  if (!amount.ok) return { ok: false, error: amount.error };

  if (typeof body.purpose !== "string" || !body.purpose.trim()) {
    return {
      ok: false,
      error: "purpose is required: a short description of what this payout is for.",
    };
  }
  const purpose = body.purpose.trim().replace(/\s+/g, " ");
  if (purpose.length < MIN_PURPOSE_LENGTH || purpose.length > MAX_PURPOSE_LENGTH) {
    return {
      ok: false,
      error: `purpose must be between ${MIN_PURPOSE_LENGTH} and ${MAX_PURPOSE_LENGTH} characters.`,
    };
  }
  // Control characters would land inside the canonical string that gets hashed, where a
  // stray newline could make two different purposes collide.
  if (/[\u0000-\u001F\u007F]/.test(purpose)) {
    return { ok: false, error: "purpose must not contain control characters." };
  }
  // `|` and `=` separate fields in the canonical string. Allowing them would let one
  // field impersonate another inside the digest.
  if (purpose.includes("|")) {
    return { ok: false, error: 'purpose must not contain the "|" character.' };
  }

  if (typeof body.policyRef !== "string" || !body.policyRef.trim()) {
    return {
      ok: false,
      error:
        "policyRef is required: this payout must name the rule that authorises it. " +
        "A treasury movement with no stated authority is not accepted here.",
    };
  }
  const policyRef = body.policyRef.trim();
  if (!POLICY_REF_PATTERN.test(policyRef)) {
    return {
      ok: false,
      error:
        "policyRef must be 3 to 64 characters of letters, digits, dot, colon, dash or " +
        "underscore, for example \"treasury.rebalance.v2\".",
    };
  }

  return { ok: true, request: { amountUsd: amount.amountUsd, purpose, policyRef } };
}

export interface Authorization {
  policyRef: string;
  purpose: string;
  /** Exactly what was hashed, so the digest can be recomputed by hand. */
  canonical: string;
  /** sha256 of `canonical`, hex. */
  digest: string;
}

/**
 * Bind the payout to its stated authority.
 *
 * Canonical form is `field=value` pairs joined by `|`, in fixed order, so the digest is
 * stable across callers and machines. The route id is included: the same authorization
 * against a different rail is a different payout, and should not silently deduplicate
 * against the first one.
 */
export function authorize(request: PayoutRequest, paymentRouteId: string): Authorization {
  const canonical = [
    `policy=${request.policyRef}`,
    `purpose=${request.purpose}`,
    `amountUsd=${request.amountUsd}`,
    `route=${paymentRouteId}`,
  ].join("|");

  return {
    policyRef: request.policyRef,
    purpose: request.purpose,
    canonical,
    digest: createHash("sha256").update(canonical, "utf8").digest("hex"),
  };
}

export interface PayoutRails {
  /** Rain's own values, read back from the route. Null when Rain does not report one. */
  source: { rail: string | null; currency: string | null };
  destination: { rail: string | null; currency: string | null };
}

/** Read the rails off the route rather than asserting what they are. */
export function railsFrom(route: PaymentRoute): PayoutRails {
  return {
    source: { rail: route.source?.rail ?? null, currency: route.source?.currency ?? null },
    destination: {
      rail: route.destination?.rail ?? null,
      currency: route.destination?.currency ?? null,
    },
  };
}

export const SANDBOX_DISCLAIMER =
  "Accepted by Rain's sandbox. This is a simulated transfer: no real funds moved, no bank " +
  "account was debited, and nothing has settled. Rain answers 202 (accepted and processing), " +
  "which is not confirmation of receipt.";

export interface PayoutAccepted {
  /** Only ever the accepted wording. There is no success variant beyond this one. */
  outcome: "accepted-by-rain-sandbox";
  /** A literal false. Settlement is not something this capability can report. */
  settled: false;
  environment: "rain-sandbox";
  disclaimer: string;
  amountUsd: string;
  routeId: string;
  routeStatus: string | null;
  rails: PayoutRails;
  /** Null when Rain acknowledges without one. Never filled in. */
  simulationId: string | null;
  transferId: string | null;
  flow: string | null;
  /** Rain's own status string, or "accepted" when it reports none. */
  railStatus: string;
  authorization: Authorization;
}

/**
 * Build the result from what Rain actually returned.
 *
 * Split out from the network call so the shape can be tested without a live rail, and so
 * the "never claim more than Rain said" rule is enforced in one readable place.
 */
export function acceptedResult(params: {
  request: PayoutRequest;
  authorization: Authorization;
  route: PaymentRoute;
  simulation: TransferSimulation | null;
}): PayoutAccepted {
  const { request, authorization, route, simulation } = params;
  const sim = (simulation ?? {}) as TransferSimulation & { transferId?: unknown; id?: unknown };
  const transferId =
    typeof sim.transferId === "string" ? sim.transferId
    : typeof sim.id === "string" ? sim.id
    : null;

  return {
    outcome: "accepted-by-rain-sandbox",
    settled: false,
    environment: "rain-sandbox",
    disclaimer: SANDBOX_DISCLAIMER,
    amountUsd: request.amountUsd,
    routeId: route.id,
    routeStatus: route.status ?? null,
    rails: railsFrom(route),
    simulationId: typeof sim.simulationId === "string" ? sim.simulationId : null,
    transferId,
    flow: typeof sim.flow === "string" ? sim.flow : null,
    railStatus: typeof sim.status === "string" ? sim.status : "accepted",
    authorization,
  };
}

export type PayoutOutcome =
  | { configured: false; reason: string }
  | { configured: true; result: PayoutAccepted };

/**
 * Run a conditional payout end to end.
 *
 * Order matters. Configuration is checked before anything else, the route is read back
 * before it is used — which confirms the id belongs to this tenant and yields the real
 * rails to display — and only then is the transfer simulated. A Rain rejection throws
 * `PaymentRouteError` and never reaches `acceptedResult`, so there is no path on which this
 * returns an accepted payout that Rain did not accept.
 */
export async function requestPayout(request: PayoutRequest): Promise<PayoutOutcome> {
  const state = readConfig();
  if (!state.configured) return { configured: false, reason: state.reason };

  const { paymentRouteId } = state.config;
  const authorization = authorize(request, paymentRouteId);

  const route = await getPaymentRoute(paymentRouteId);
  const simulation = await simulateTransfer({
    paymentRouteId,
    amountUsd: request.amountUsd,
    // The authorization itself is the idempotency key, so replaying the same authorised
    // payout is the same payout rather than a second one.
    idempotencyKey: authorization.digest,
  });

  return {
    configured: true,
    result: acceptedResult({ request, authorization, route, simulation }),
  };
}
