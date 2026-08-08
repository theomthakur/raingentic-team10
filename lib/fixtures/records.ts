import type { BudgetRecord, QuoteRecord } from "@/lib/types";

/**
 * The system of record Mandate checks declarations against.
 *
 * In production this is an ERP. Here it is a small in-process store that the demo can
 * reset, but the important part is that the checker only ever sees a *snapshot* of it —
 * `lib/store` is what takes that snapshot, and the decision log keeps it forever.
 */

export const VENDORS = [
  "Nordhaven Supply Co",
  "Bellweather Industrial",
  "Kestrel Components",
  "Ardent Materials",
  "Pallas Logistics",
  "Verity Office Group",
] as const;

export const COST_CENTRES = ["CC-OPS", "CC-ENG", "CC-FAC", "CC-MKT"] as const;

export const SEED_QUOTES: QuoteRecord[] = [
  {
    poNumber: "PO-4417",
    status: "accepted",
    fulfilled: false,
    vendor: "Nordhaven Supply Co",
    sku: "NH-BRK-2200",
    unitPrice: 12_450,
    quantity: 12,
    quoteExpiry: "2026-08-31T23:59:59.000Z",
  },
  {
    poNumber: "PO-4418",
    status: "accepted",
    fulfilled: false,
    vendor: "Kestrel Components",
    sku: "KC-SEN-118",
    unitPrice: 8_900,
    quantity: 40,
    quoteExpiry: "2026-08-24T23:59:59.000Z",
  },
  {
    poNumber: "PO-4419",
    status: "accepted",
    fulfilled: true, // already fulfilled — rule 2 catches a re-purchase
    vendor: "Ardent Materials",
    sku: "AM-ALLOY-7",
    unitPrice: 31_000,
    quantity: 4,
    quoteExpiry: "2026-09-15T23:59:59.000Z",
  },
  {
    poNumber: "PO-4420",
    status: "draft", // never accepted — rule 1 catches it
    fulfilled: false,
    vendor: "Bellweather Industrial",
    sku: "BW-CONV-90",
    unitPrice: 145_000,
    quantity: 1,
    quoteExpiry: "2026-09-01T23:59:59.000Z",
  },
  {
    poNumber: "PO-4421",
    status: "accepted",
    fulfilled: false,
    vendor: "Verity Office Group",
    sku: "VO-CHAIR-M4",
    unitPrice: 24_900,
    quantity: 8,
    quoteExpiry: "2026-08-09T23:59:59.000Z",
  },
  {
    poNumber: "PO-4422",
    status: "accepted",
    fulfilled: false,
    vendor: "Pallas Logistics",
    sku: "PL-FRT-EU3",
    unitPrice: 96_000,
    quantity: 1,
    quoteExpiry: "2026-08-20T23:59:59.000Z",
  },
];

/**
 * Every cost centre a demo task charges to must have clear headroom, so that a task
 * written to demonstrate one rule fails on exactly that rule. PO-4421 exists to show a
 * vendor mismatch; if CC-FAC were also near its limit, the refusal would cite two rules
 * and the point would blur.
 *
 * CC-MKT is deliberately left near its limit — no task touches it, so it drives the amber
 * budget meter without interfering with anything.
 */
export const SEED_BUDGETS: BudgetRecord[] = [
  { costCentre: "CC-OPS", limitCents: 2_500_000, spentCents: 1_180_000 },
  { costCentre: "CC-ENG", limitCents: 4_000_000, spentCents: 2_640_000 },
  { costCentre: "CC-FAC", limitCents: 1_400_000, spentCents: 812_000 },
  { costCentre: "CC-MKT", limitCents: 1_200_000, spentCents: 1_140_000 },
];

/** Which cost centre each PO is charged to. */
export const PO_COST_CENTRE: Record<string, string> = {
  "PO-4417": "CC-OPS",
  "PO-4418": "CC-ENG",
  "PO-4419": "CC-ENG",
  "PO-4420": "CC-FAC",
  "PO-4421": "CC-FAC",
  "PO-4422": "CC-OPS",
};

export const AGENTS = ["procurement-01", "procurement-02", "facilities-01"] as const;
