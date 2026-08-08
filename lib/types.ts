/**
 * Shared shapes between A (this file, the Rain/agent side) and B (the checker).
 * Agree any change to PurchaseOrder with B before changing it, this is the join contract.
 *
 * Money is integer cents throughout, never floats. See lib/money.ts.
 */

export interface PurchaseOrder {
  poNumber: string;
  vendor: string;
  sku: string;
  unitPrice: number; // cents
  quantity: number;
  quoteExpiry: string; // ISO date, YYYY-MM-DD
  costCentre?: string;
}

export interface VendorQuote {
  vendor: string;
  sku: string;
  unitPrice: number; // cents
  quantity: number;
  validUntil: string; // ISO date
}

/** What B's verify() returns. A reads .ok to decide whether to call Rain at all. */
export interface CheckResult {
  ok: boolean;
  failures: { rule: string; reason: string }[];
}

/** The subset of a Rain scoped virtual card A actually needs downstream. */
export interface ScopedCard {
  cardId: string;
  lastFour: string;
  status: "active" | "inactive";
  limitCents: number;
  expiresAt: string;
}
