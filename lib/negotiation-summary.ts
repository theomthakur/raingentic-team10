import type { NegotiationResult } from "@/lib/negotiation";
import type { NegotiationSummary } from "@/lib/types";

/**
 * Flatten A's negotiation result into the shape the record keeps and the UI draws.
 *
 * Pairing each seller's opening price with its final one is the whole visual: you can see
 * who moved, who didn't, and by how much. A single list of final prices would hide the
 * thing that makes the strategies legible.
 */
export function toSummary(
  result: NegotiationResult,
  taskKey: string,
  buyerTargetCents: number
): NegotiationSummary {
  const openingByVendor = new Map(result.openingOffers.map((o) => [o.vendor, o]));

  return {
    taskKey,
    buyerTargetCents,
    roundCount: 1,
    offers: result.finalOffers
      .map((final) => {
        const opening = openingByVendor.get(final.vendor);
        return {
          vendor: final.vendor,
          strategy: final.strategy,
          label: final.label,
          opening: opening?.price ?? final.price,
          final: final.price,
          note: final.note,
          won: final.vendor === result.winner.vendor,
        };
      })
      // Cheapest first: the winner sits at the top, and the concession gaps read down
      // the column rather than needing to be hunted for.
      .sort((a, b) => a.final - b.final),
  };
}
