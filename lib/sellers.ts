/**
 * Seller fixtures for the negotiation stage. Four distinct strategies, same spirit as the
 * original ten-strategy version, sized down. Extend this list per task as needed for the
 * demo, the negotiate() function in lib/negotiation.ts doesn't care how many there are.
 */

import type { SellerProfile } from "./negotiation";

export const SELLERS_BY_TASK: Record<string, SellerProfile[]> = {
  "office-supplies": [
    { vendor: "Office Depot", strategy: "discounter", sku: "SKU-4471", listPrice: 4799, available: 25, validUntil: "2026-08-15" },
    { vendor: "Staples Business", strategy: "firm", sku: "SKU-4471", listPrice: 4299, available: 20, validUntil: "2026-08-15" },
    { vendor: "Quill Corp", strategy: "bundler", sku: "SKU-4471", listPrice: 4550, available: 15, validUntil: "2026-08-12" },
    { vendor: "ClearStock Supply", strategy: "urgency", sku: "SKU-4471", listPrice: 4650, available: 10, validUntil: "2026-08-10" },
  ],
  "cloud-compute": [
    { vendor: "Akash Network", strategy: "discounter", sku: "GPU-A100-1H", listPrice: 14000, available: 8, validUntil: "2026-08-09" },
    { vendor: "Lambda Labs", strategy: "firm", sku: "GPU-A100-1H", listPrice: 13500, available: 6, validUntil: "2026-08-09" },
    { vendor: "CoreWeave", strategy: "urgency", sku: "GPU-A100-1H", listPrice: 13800, available: 4, validUntil: "2026-08-09" },
  ],
};
