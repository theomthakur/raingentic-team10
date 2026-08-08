import type { Cents, PurchaseOrder } from "@/lib/types";

/**
 * 🔴 THE 17:00 JOIN SEAM.
 *
 * B owns everything up to here. A owns what happens inside `issueViaRain`.
 *
 * The contract between the two halves is exactly this file: the pipeline calls
 * `issueCard()` only after `verify()` has already returned ok, and a refusal means this
 * function is never called at all. That is the whole thesis — a failed check does not
 * produce a declined transaction, it produces no instrument, because nothing downstream
 * of the check ever ran.
 */

export interface IssueRequest {
  po: PurchaseOrder;
  /** Exactly the approved total. Never a round number, never a standing limit. */
  limitCents: Cents;
}

export interface IssuedCard {
  cardId: string;
  last4: string;
  limitCents: Cents;
  expiresAt: string;
  /** True when no Rain credentials were present and this card is a local stand-in. */
  simulated: boolean;
}

/**
 * A stand-in card so the decision layer is demonstrable before A's Rain call lands.
 * Deterministic from the PO number so re-running a demo does not reshuffle the UI.
 */
function simulate(req: IssueRequest): IssuedCard {
  let h = 0;
  for (const ch of req.po.poNumber) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    cardId: `sim_${h.toString(16).padStart(8, "0")}`,
    last4: String(1000 + (h % 9000)),
    limitCents: req.limitCents,
    expiresAt: req.po.quoteExpiry,
    simulated: true,
  };
}

/**
 * A: replace the body of this function with the real `issueRainCard()` call.
 *
 * Scope the card to exactly `req.limitCents`, single use, expiry no later than
 * `req.po.quoteExpiry`, and merchant-locked to `req.po.vendor` if the endpoint supports
 * it. Return the same shape with `simulated: false`. Nothing else in the app needs to
 * change — the pipeline, the log, replay and the UI all read this interface.
 */
async function issueViaRain(_req: IssueRequest): Promise<IssuedCard> {
  throw new Error("Rain issuance not wired yet — A owns this call.");
}

export async function issueCard(req: IssueRequest): Promise<IssuedCard> {
  if (!process.env.RAIN_API_KEY) return simulate(req);
  try {
    return await issueViaRain(req);
  } catch {
    // Never fail the demo on a credential problem, but never claim a real card either.
    return simulate(req);
  }
}
