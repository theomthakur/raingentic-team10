/**
 * The quote stage. Deliberately small, this is cut line #1 in the plan.
 *
 * A real multi-round negotiation between seller agents is the most fakeable thing in the
 * demo (RETHINK.md), so this does the minimum honest version: a fixed set of vendor quotes
 * for a task, one comparison, the cheapest that meets spec wins. If there's time later,
 * `selectQuote` is the one function to extend into something closer to a real negotiation,
 * everything downstream only depends on it returning a VendorQuote.
 */

import type { VendorQuote } from "./types";

/** Sample vendor quotes for development and the demo. Replace/extend per task as needed. */
export const SAMPLE_QUOTES: Record<string, VendorQuote[]> = {
  "office-supplies": [
    { vendor: "Staples Business", sku: "SKU-4471", unitPrice: 4299, quantity: 10, validUntil: "2026-08-15" },
    { vendor: "Quill Corp", sku: "SKU-4471", unitPrice: 4550, quantity: 10, validUntil: "2026-08-12" },
    { vendor: "Office Depot", sku: "SKU-4471", unitPrice: 4199, quantity: 10, validUntil: "2026-08-10" },
  ],
  "cloud-compute": [
    { vendor: "Akash Network", sku: "GPU-A100-1H", unitPrice: 12000, quantity: 4, validUntil: "2026-08-09" },
    { vendor: "Lambda Labs", sku: "GPU-A100-1H", unitPrice: 13500, quantity: 4, validUntil: "2026-08-09" },
  ],
};

/**
 * Pick the winning quote for a task. Cheapest that has quantity available and has not
 * expired. Pure function, no I/O, easy to replace with something smarter later.
 */
export function selectQuote(taskKey: string, quantity: number, asOf = new Date()): VendorQuote {
  const candidates = SAMPLE_QUOTES[taskKey];
  if (!candidates?.length) throw new Error(`No vendor quotes available for "${taskKey}".`);

  const eligible = candidates.filter(
    (q) => q.quantity >= quantity && new Date(q.validUntil) >= asOf,
  );
  if (eligible.length === 0) {
    throw new Error(`No eligible quote for "${taskKey}" at quantity ${quantity}.`);
  }

  return eligible.reduce((cheapest, q) => (q.unitPrice < cheapest.unitPrice ? q : cheapest));
}
