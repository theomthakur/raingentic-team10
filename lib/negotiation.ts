/**
 * The negotiation stage. Om's own idea, reimplemented fresh today, sized down from the
 * original ten-seller, live-LLM-per-turn version to something that fits one afternoon
 * without threatening the Rain integration time.
 *
 * Distinct seller strategies (named the same way the original project named them) compete
 * for a buyer agent's business. One counter-offer round. Deterministic concession curves
 * per strategy, not a live model call, on purpose: this feeds the PO that gets verified
 * downstream, and everything downstream stays pure. If a live LLM call is ever added here
 * later, it stays upstream of PROPOSE and never enters lib/verify.ts.
 */

import type { VendorQuote } from "./types";

export type SellerStrategy = "firm" | "discounter" | "bundler" | "urgency";

const STRATEGY_LABEL: Record<SellerStrategy, string> = {
  firm: "Firm Pricing",
  discounter: "Aggressive Discounter",
  bundler: "Bundler",
  urgency: "Limited Inventory",
};

/** How much of the gap to the buyer's target a seller concedes on the counter-offer round. */
const CONCESSION_RATE: Record<SellerStrategy, number> = {
  firm: 0.05,
  discounter: 0.55,
  bundler: 0.25,
  urgency: 0.15,
};

/** Sellers will not go below this fraction of their list price, no matter how far the
 * buyer's target is. Keeps the negotiation honest rather than always reaching the target. */
const FLOOR_FRACTION = 0.82;

export interface SellerProfile {
  vendor: string;
  strategy: SellerStrategy;
  sku: string;
  listPrice: number; // cents, per unit
  available: number;
  validUntil: string; // ISO date
}

export interface NegotiationOffer {
  vendor: string;
  strategy: SellerStrategy;
  label: string;
  price: number; // cents, per unit
  note: string;
}

export interface NegotiationResult {
  winner: VendorQuote;
  winnerNote: string;
  openingOffers: NegotiationOffer[];
  finalOffers: NegotiationOffer[];
  losingBids: { vendor: string; finalPrice: number; whyLost: string }[];
}

function openingNote(strategy: SellerStrategy, price: number): string {
  switch (strategy) {
    case "firm":
      return `holds at list price, ${(price / 100).toFixed(2)}`;
    case "discounter":
      return `opens low to close fast, ${(price / 100).toFixed(2)}`;
    case "bundler":
      return `quotes ${(price / 100).toFixed(2)} plus extended warranty`;
    case "urgency":
      return `${(price / 100).toFixed(2)}, limited stock, quote expires soon`;
  }
}

function concessionNote(strategy: SellerStrategy, moved: boolean, price: number): string {
  if (!moved) return `holds firm at ${(price / 100).toFixed(2)}`;
  switch (strategy) {
    case "firm":
      return `moves a little, to ${(price / 100).toFixed(2)}`;
    case "discounter":
      return `drops to ${(price / 100).toFixed(2)} to win the deal`;
    case "bundler":
      return `comes down to ${(price / 100).toFixed(2)}, keeps the warranty`;
    case "urgency":
      return `${(price / 100).toFixed(2)}, last chance before stock clears`;
  }
}

/**
 * Run one negotiation: opening offers, one counter-offer round toward a target price,
 * pick the cheapest eligible final offer, explain why every loser lost.
 *
 * Pure function. No I/O, no randomness, same input always produces the same result, which
 * matters for the demo: rerunning it live behaves identically every time.
 */
export function negotiate(
  sellers: SellerProfile[],
  quantity: number,
  targetPriceCents: number,
  sku: string,
  asOf = new Date(),
): NegotiationResult {
  const eligible = sellers.filter(
    (s) => s.available >= quantity && new Date(s.validUntil) >= asOf,
  );
  if (eligible.length === 0) {
    throw new Error(`No seller has ${quantity} units of "${sku}" available before expiry.`);
  }

  const openingOffers: NegotiationOffer[] = eligible.map((s) => ({
    vendor: s.vendor,
    strategy: s.strategy,
    label: STRATEGY_LABEL[s.strategy],
    price: s.listPrice,
    note: openingNote(s.strategy, s.listPrice),
  }));

  const finalOffers: NegotiationOffer[] = eligible.map((s) => {
    if (s.listPrice <= targetPriceCents) {
      // Already meets the buyer's target, no need to counter this one.
      return {
        vendor: s.vendor,
        strategy: s.strategy,
        label: STRATEGY_LABEL[s.strategy],
        price: s.listPrice,
        note: `already at or under target, ${(s.listPrice / 100).toFixed(2)}`,
      };
    }
    const floor = Math.round(s.listPrice * FLOOR_FRACTION);
    const gap = s.listPrice - targetPriceCents;
    const conceded = Math.round(s.listPrice - gap * CONCESSION_RATE[s.strategy]);
    const finalPrice = Math.max(conceded, floor);
    return {
      vendor: s.vendor,
      strategy: s.strategy,
      label: STRATEGY_LABEL[s.strategy],
      price: finalPrice,
      note: concessionNote(s.strategy, finalPrice < s.listPrice, finalPrice),
    };
  });

  const winner = finalOffers.reduce((cheapest, o) => (o.price < cheapest.price ? o : cheapest));
  const winnerSeller = eligible.find((s) => s.vendor === winner.vendor)!;

  const losingBids = finalOffers
    .filter((o) => o.vendor !== winner.vendor)
    .map((o) => ({
      vendor: o.vendor,
      finalPrice: o.price,
      whyLost: `${(o.price / 100).toFixed(2)} vs the winning ${(winner.price / 100).toFixed(2)}, ${STRATEGY_LABEL[o.strategy].toLowerCase()} would not concede further`,
    }));

  return {
    winner: {
      vendor: winner.vendor,
      sku,
      unitPrice: winner.price,
      quantity,
      validUntil: winnerSeller.validUntil,
    },
    winnerNote: `${winner.label} won at ${(winner.price / 100).toFixed(2)}, ${concessionNote(winner.strategy, winner.price < winnerSeller.listPrice, winner.price)}`,
    openingOffers,
    finalOffers,
    losingBids,
  };
}
