/**
 * Seller fixtures for the negotiation stage. Four distinct strategies, same spirit as the
 * original ten-strategy version, sized down. Extend this list per task as needed for the
 * demo, the negotiate() function in lib/negotiation.ts doesn't care how many there are.
 */

import type { SellerProfile } from "./negotiation";

/**
 * Quote expiry, as a number of days from now rather than a date typed in by hand.
 *
 * These used to be literal dates, and they quietly became a time bomb: `negotiate()` drops
 * any seller whose quote has expired, and the GPU quotes said 2026-08-09. Vercel runs in
 * UTC, so the deployed site crossed that boundary hours before a laptop in New York did,
 * every compute seller was filtered out and the task failed with "no seller has N units
 * available" on the live URL while still working locally.
 *
 * A demo fixture must not depend on what day it is read. The relative spread below keeps
 * the shape that matters: some quotes run out sooner than others, which is what makes the
 * urgency strategy mean anything: without any of them ever going stale.
 */
function inDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(23, 59, 59, 0);
  return d.toISOString().slice(0, 10);
}

export const SELLERS_BY_TASK: Record<string, SellerProfile[]> = {
  "office-supplies": [
    { vendor: "Office Depot", strategy: "discounter", sku: "SKU-4471", listPrice: 4799, available: 25, validUntil: inDays(14) },
    { vendor: "Staples Business", strategy: "firm", sku: "SKU-4471", listPrice: 4299, available: 20, validUntil: inDays(14) },
    { vendor: "Quill Corp", strategy: "bundler", sku: "SKU-4471", listPrice: 4550, available: 15, validUntil: inDays(11) },
    { vendor: "ClearStock Supply", strategy: "urgency", sku: "SKU-4471", listPrice: 4650, available: 10, validUntil: inDays(9) },
  ],
  "cloud-compute": [
    { vendor: "Akash Network", strategy: "discounter", sku: "GPU-A100-1H", listPrice: 14000, available: 8, validUntil: inDays(8) },
    { vendor: "Lambda Labs", strategy: "firm", sku: "GPU-A100-1H", listPrice: 13500, available: 6, validUntil: inDays(8) },
    { vendor: "CoreWeave", strategy: "urgency", sku: "GPU-A100-1H", listPrice: 13800, available: 4, validUntil: inDays(7) },
  ],
};
