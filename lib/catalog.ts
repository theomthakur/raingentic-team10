import { SELLERS_BY_TASK } from "./sellers";
import { PO_COST_CENTRE, SEED_QUOTES } from "./fixtures/records";
import type { Cents } from "./types";

/**
 * The storefront.
 *
 * Nothing here invents a price. Every number is derived from the same fixtures the
 * pipeline already runs on — `SELLERS_BY_TASK` for the lines that get negotiated, and
 * `SEED_QUOTES` for the lines that already have an accepted quote on the record. This
 * file only adds the things a catalogue needs and a purchase order doesn't: a human name,
 * a description, a unit, and a picture.
 *
 * The two kinds are not a cosmetic split. They are the two real paths through the system:
 *
 *  - `negotiated` — no quote exists yet. Sellers compete, one wins, and the winning price
 *    becomes the purchase order that then gets verified. Buying a different quantity is a
 *    genuinely different order line, so it gets its own PO number and negotiates again.
 *  - `contract`   — a quote is already accepted on the record. Buying it declares against
 *    that quote, so the declared total has to match what was quoted. Change the quantity
 *    and the amount check refuses it, which is the point.
 */

export type ProductKind = "negotiated" | "contract";

export interface CatalogProduct {
  id: string;
  name: string;
  blurb: string;
  unit: string;
  glyph: GlyphKey;
  /** Original, unbranded commercial product photography used in the catalog. */
  image: string;
  /** The delegated agent that owns this category of spend. */
  agent: string;
  kind: ProductKind;
  /** Cheapest list price across competing sellers, or the quoted unit price. */
  fromCents: Cents;
  costCentre: string;
  /** negotiated only */
  taskKey?: string;
  sellerCount?: number;
  /**
   * The most any single supplier can actually ship. Negotiation drops sellers who cannot
   * meet the quantity, so asking for more than this throws rather than producing a
   * decision — an error is a far worse demo than a refusal.
   */
  maxAvailable?: number;
  /** contract only */
  poNumber?: string;
  vendor?: string;
  sku?: string;
  quotedQuantity?: number;
  /** A quote already marked fulfilled — buying it again is a duplicate, by design. */
  alreadyFulfilled?: boolean;
}

export type GlyphKey =
  | "paper"
  | "gpu"
  | "chair"
  | "sensor"
  | "bracket"
  | "alloy"
  | "freight"
  | "conveyor";

/** Copy for the negotiated lines, keyed by the task the negotiation engine knows. */
const NEGOTIATED_META: Record<
  string,
  { name: string; blurb: string; unit: string; glyph: GlyphKey; image: string; costCentre: string }
> = {
  "office-supplies": {
    name: "A4 paper, 5-ream box",
    blurb: "Four suppliers quote against each other, one counter-offer round, cheapest qualifying bid wins.",
    unit: "box",
    glyph: "paper",
    image: "/catalog/a4-paper.png",
    costCentre: "CC-OPS",
  },
  "cloud-compute": {
    name: "A100 GPU, compute hour",
    blurb: "Three compute vendors in a tighter market with a shorter quote window.",
    unit: "GPU-hour",
    glyph: "gpu",
    image: "/catalog/gpu.png",
    costCentre: "CC-ENG",
  },
};

/** Copy for the lines that already sit on the record as accepted quotes. */
const CONTRACT_META: Record<string, { name: string; blurb: string; unit: string; glyph: GlyphKey; image: string; agent: string }> = {
  "PO-4417": {
    name: "Steel mounting bracket",
    blurb: "Standing order line, quote accepted and open.",
    unit: "bracket",
    glyph: "bracket",
    image: "/catalog/bracket.png",
    agent: "procurement-01",
  },
  "PO-4418": {
    name: "Industrial proximity sensor",
    blurb: "Engineering stock line, quote accepted and open.",
    unit: "sensor",
    glyph: "sensor",
    image: "/catalog/sensor.png",
    agent: "procurement-01",
  },
  "PO-4419": {
    name: "Alloy stock, grade 7",
    blurb: "Already delivered and paid. Buying it again is a duplicate — the record says so.",
    unit: "billet",
    glyph: "alloy",
    image: "/catalog/alloy.png",
    agent: "procurement-01",
  },
  "PO-4421": {
    name: "Task chair, M4",
    blurb: "Facilities line, quote accepted and open.",
    unit: "chair",
    glyph: "chair",
    image: "/catalog/chair.png",
    agent: "facilities-01",
  },
  "PO-4422": {
    name: "EU freight lane booking",
    blurb: "Logistics line, quote accepted and open.",
    unit: "booking",
    glyph: "freight",
    image: "/catalog/freight.png",
    agent: "procurement-01",
  },
  "PO-4423": {
    name: "Conveyor section, 90cm",
    blurb: "Capital equipment. Large enough that a person has to release it.",
    unit: "section",
    glyph: "conveyor",
    image: "/catalog/conveyor.png",
    agent: "procurement-02",
  },
};

function negotiatedProducts(): CatalogProduct[] {
  return Object.entries(NEGOTIATED_META).flatMap(([taskKey, meta]) => {
    const sellers = SELLERS_BY_TASK[taskKey];
    if (!sellers?.length) return [];
    return [
      {
        id: taskKey,
        kind: "negotiated" as const,
        taskKey,
        name: meta.name,
        blurb: meta.blurb,
        unit: meta.unit,
        glyph: meta.glyph,
        image: meta.image,
        agent: taskKey,
        costCentre: meta.costCentre,
        fromCents: Math.min(...sellers.map((s) => s.listPrice)),
        sellerCount: sellers.length,
        maxAvailable: Math.max(...sellers.map((seller) => seller.available)),
      },
    ];
  });
}

function contractProducts(): CatalogProduct[] {
  return SEED_QUOTES.filter((q) => q.status === "accepted" && CONTRACT_META[q.poNumber]).map((q) => {
    const meta = CONTRACT_META[q.poNumber];
    return {
      id: q.poNumber,
      kind: "contract" as const,
      poNumber: q.poNumber,
      vendor: q.vendor,
      sku: q.sku,
      name: meta.name,
      blurb: meta.blurb,
      unit: meta.unit,
      glyph: meta.glyph,
      image: meta.image,
      agent: meta.agent,
      costCentre: PO_COST_CENTRE[q.poNumber] ?? "CC-OPS",
      fromCents: q.unitPrice,
      quotedQuantity: q.quantity,
      alreadyFulfilled: q.fulfilled,
    };
  });
}

export function getCatalog(): CatalogProduct[] {
  return [...negotiatedProducts(), ...contractProducts()];
}
