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

/**
 * What the issuer can actually do right now, as opposed to what it is configured to do.
 *
 * `off`       no API key — every card is a local stand-in and nothing pretends otherwise.
 * `simulated` a key is present, but no real card has been issued yet, or the last real
 *             attempt failed. This is the dangerous state to get wrong: a key in the
 *             environment is not the same as a working integration, and a badge that
 *             reads "live" while every card is simulated is exactly the kind of thing
 *             this whole project exists to argue against.
 * `live`      a real Rain card has actually come back from the API.
 */
export type RainMode = "off" | "simulated" | "live";

let lastRealIssuance: { ok: boolean; reason?: string } | null = null;

/**
 * Real issuance is opt-in, and off by default. This is not timidity — it is that an
 * attempt today has only downside:
 *
 * Rain accepts the create call but ignores the spend limit, returning an ACTIVE card with
 * no scope and a 2031 expiry. We then correctly refuse to present that as a scoped card,
 * so the demo shows a simulated one either way — but the unscoped card still exists on
 * the account, and `PATCH` cannot deactivate it until the status enum is confirmed. So
 * every run would leave behind a live, unscoped, undeletable card in exchange for
 * nothing. Flip this to `true` the moment a Rain engineer confirms the `configuration`
 * schema; the code path is already correct and tested.
 */
function liveIssuanceEnabled(): boolean {
  return process.env.RAIN_LIVE_ISSUANCE === "true";
}

export function rainIssuanceStatus(): { mode: RainMode; reason?: string } {
  if (!process.env.RAIN_API_KEY) {
    return { mode: "off", reason: "No RAIN_API_KEY set." };
  }
  if (lastRealIssuance?.ok) return { mode: "live" };
  if (!liveIssuanceEnabled()) {
    return {
      mode: "simulated",
      reason:
        "Connected to Rain, but real issuance is deliberately off: Rain ignores the spend limit today, and an unscoped card cannot be deactivated. Set RAIN_LIVE_ISSUANCE=true once the configuration schema is confirmed.",
    };
  }
  return {
    mode: "simulated",
    reason:
      lastRealIssuance?.reason ??
      "API key present, but no card has been issued through Rain yet this session.",
  };
}

export async function issueCard(req: IssueRequest): Promise<IssuedCard> {
  if (!process.env.RAIN_API_KEY || !liveIssuanceEnabled()) return simulate(req);
  try {
    const card = await issueViaRain(req);
    lastRealIssuance = { ok: true };
    return card;
  } catch (err) {
    // Never fail the demo on a credential problem, and never claim a real card either —
    // but do remember *why*, so the UI can say "simulated" instead of "live" rather than
    // silently degrading while the badge still reads green.
    lastRealIssuance = { ok: false, reason: (err as Error).message.split("\n")[0].slice(0, 160) };
    return simulate(req);
  }
}

/**
 * Stage 7 — retire the card once the obligation behind it is done.
 *
 * Rain's own framing is that an agent's card is "retired automatically once the job is
 * done." Every team this weekend will demo a card being born; this is the other half. It
 * also pre-empts "what stops the agent reusing the card" without having to argue: the
 * instrument exists for exactly the duration of the obligation and not a minute longer.
 *
 * 🔴 `RAIN_CARD_INACTIVE_STATUS` is the one unknown. `PATCH /issuing/cards/{id}` exists
 * and accepts a body, but `{"status":"inactive"}` returns 400, so the accepted enum value
 * has not been confirmed. Ask a Rain engineer, put the answer in `.env.local`, and this
 * starts working with no code change. Until then a simulated card is retired locally and
 * the UI says so rather than claiming a revocation that did not happen.
 */
export async function revokeCard(cardId: string): Promise<{ revoked: boolean; simulated: boolean }> {
  const status = process.env.RAIN_CARD_INACTIVE_STATUS;

  if (!process.env.RAIN_API_KEY || !status || cardId.startsWith("sim_")) {
    return { revoked: true, simulated: true };
  }

  try {
    const { setCardStatus } = await import("@/lib/rain-client");
    await setCardStatus(cardId, status);
    return { revoked: true, simulated: false };
  } catch {
    // A card we could not retire is worth knowing about — do not report success.
    return { revoked: false, simulated: false };
  }
}
