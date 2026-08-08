import type { Cents, PurchaseOrder } from "@/lib/types";
import { issueScopedCard } from "@/lib/rain-client";

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
 * The real call, through A's client in `lib/rain-client.ts`.
 *
 * The card is scoped to exactly the approved total — not rounded up, not a standing limit
 * — and expires with the quote it is bound to, so the instrument cannot outlive the
 * obligation that justified it.
 */
async function issueViaRain(req: IssueRequest): Promise<IssuedCard> {
  const card = await issueScopedCard({
    limitCents: req.limitCents,
    expiresAt: req.po.quoteExpiry,
    reference: req.po.poNumber,
    // ⚠️ Only set once a Rain engineer confirms exact-merchant locking is supported.
    // Category-level locking would be a weaker claim, so we do not assert it yet.
    // merchantLock: req.po.vendor,
  });

  return {
    cardId: card.cardId,
    last4: card.lastFour,
    limitCents: card.limitCents,
    expiresAt: card.expiresAt,
    simulated: false,
  };
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
