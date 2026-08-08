/**
 * Generates the committed history in `decisions.json`.
 *
 * Why this exists: replaying the six decisions a live demo produces reads as a test file.
 * "One approval would now be refused" is an anecdote. Forty-seven rows across several cost
 * centres, agents and vendors makes the replay diff read like a system of record, which is
 * the entire point of the feature.
 *
 * The output is deterministic — a fixed-seed PRNG — so regenerating never produces a
 * spurious diff, and the committed file is the same one every driver loads.
 *
 *   npm run seed
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Decision, PurchaseOrder, QuoteRecord, RecordSnapshot } from "@/lib/types";
import { poTotal } from "@/lib/types";
import { verify } from "@/lib/checks";
import { defaultRuleSet } from "@/lib/rules/defaults";
import { AGENTS, COST_CENTRES } from "@/lib/fixtures/records";
import { SELLERS_BY_TASK } from "@/lib/sellers";

/** mulberry32 — small, fast, and identical on every machine. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(20260808);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

const CATALOGUE = [
  { vendor: "Nordhaven Supply Co", sku: "NH-BRK-2200", unit: 12_450, alt: "NH-BRK-2400" },
  { vendor: "Nordhaven Supply Co", sku: "NH-SEAL-91", unit: 3_200, alt: "NH-SEAL-95" },
  { vendor: "Kestrel Components", sku: "KC-SEN-118", unit: 8_900, alt: "KC-SEN-120" },
  { vendor: "Kestrel Components", sku: "KC-RLY-04", unit: 15_600, alt: "KC-RLY-06" },
  { vendor: "Ardent Materials", sku: "AM-ALLOY-7", unit: 31_000, alt: "AM-ALLOY-9" },
  { vendor: "Bellweather Industrial", sku: "BW-CONV-90", unit: 145_000, alt: "BW-CONV-92" },
  { vendor: "Pallas Logistics", sku: "PL-FRT-EU3", unit: 96_000, alt: "PL-FRT-EU4" },
  { vendor: "Verity Office Group", sku: "VO-CHAIR-M4", unit: 24_900, alt: "VO-CHAIR-M6" },
  { vendor: "Verity Office Group", sku: "VO-DESK-S2", unit: 41_500, alt: "VO-DESK-S4" },
];

const OTHER_VENDORS = [
  "Halloway Trading",
  "Sundry Wholesale Ltd",
  "Meridian Parts Direct",
  "Colt & Rowe Supplies",
];

/**
 * The shapes of history. `drift` is the interesting one: those purchases sit inside the
 * 2% tolerance of rule version 1, so they were approved — and they are exactly what flips
 * when someone tightens that tolerance and hits replay.
 */
type Shape =
  | "clean"
  | "drift-within-tolerance"
  | "amount-over-tolerance"
  | "vendor-mismatch"
  | "sku-mismatch"
  | "already-fulfilled"
  | "over-budget"
  | "duplicate-card";

const PLAN: Shape[] = [
  ...Array<Shape>(26).fill("clean"),
  ...Array<Shape>(8).fill("drift-within-tolerance"),
  ...Array<Shape>(4).fill("amount-over-tolerance"),
  ...Array<Shape>(3).fill("vendor-mismatch"),
  ...Array<Shape>(2).fill("sku-mismatch"),
  ...Array<Shape>(2).fill("already-fulfilled"),
  ...Array<Shape>(1).fill("over-budget"),
  ...Array<Shape>(1).fill("duplicate-card"),
];

const START = Date.parse("2026-07-20T09:00:00.000Z");
const END = Date.parse("2026-08-08T11:30:00.000Z");

function build(shape: Shape, index: number): Decision {
  const item = pick(CATALOGUE);
  const costCentre = pick(COST_CENTRES);
  const quantity = between(2, 40);
  const poNumber = `PO-${4100 + index * 3 + between(0, 2)}`;
  const observedAt = new Date(START + Math.floor(rand() * (END - START))).toISOString();
  const quoteExpiry = new Date(Date.parse(observedAt) + between(7, 30) * 86_400_000).toISOString();

  const quote: QuoteRecord = {
    poNumber,
    status: "accepted",
    fulfilled: false,
    vendor: item.vendor,
    sku: item.sku,
    unitPrice: item.unit,
    quantity,
    quoteExpiry,
  };

  const po: PurchaseOrder = {
    poNumber,
    vendor: item.vendor,
    sku: item.sku,
    unitPrice: item.unit,
    quantity,
    quoteExpiry,
    costCentre,
  };

  const quoted = item.unit * quantity;
  // Budget scales with the line so headroom is guaranteed — otherwise a big-ticket item
  // trips rule 5 by accident and the shape distribution stops being deliberate, which
  // would make the replay diff unpredictable.
  const headroom = quoted + between(3, 15) * 100_000;
  let budget = {
    costCentre,
    limitCents: headroom + between(5, 30) * 100_000,
    spentCents: 0,
  };
  budget.spentCents = budget.limitCents - headroom;
  let existingCard: RecordSnapshot["existingCard"] = null;

  switch (shape) {
    case "clean":
      break;

    case "drift-within-tolerance": {
      // 40-190 bps off the quote: inside v1's 2%, outside a tightened 0%.
      const bps = between(40, 190);
      po.unitPrice = Math.round(item.unit * (1 + bps / 10_000));
      break;
    }

    case "amount-over-tolerance": {
      const bps = between(260, 900);
      po.unitPrice = Math.round(item.unit * (1 + bps / 10_000));
      break;
    }

    case "vendor-mismatch":
      po.vendor = pick(OTHER_VENDORS);
      break;

    case "sku-mismatch":
      po.sku = item.alt;
      break;

    case "already-fulfilled":
      quote.fulfilled = true;
      break;

    case "over-budget":
      budget.spentCents = budget.limitCents - Math.floor(quoted * 0.4);
      break;

    case "duplicate-card":
      existingCard = {
        cardId: `card_${Math.floor(rand() * 1e9).toString(16)}`,
        poNumber,
        issuedAt: new Date(Date.parse(observedAt) - 3_600_000).toISOString(),
      };
      break;
  }

  const record: RecordSnapshot = { quote, budget, existingCard, observedAt };
  const ruleSet = defaultRuleSet();
  const result = verify(po, record, ruleSet);

  // Three outcomes now. A purchase that only tripped the delegated limit was not wrong,
  // it was large — it waited for a person rather than being rejected.
  const outcome: Decision["outcome"] = result.ok
    ? "approved"
    : result.failures.length > 0
      ? "refused"
      : "held";

  const total = poTotal(po);
  return {
    id: `dec_seed_${String(index).padStart(3, "0")}`,
    createdAt: observedAt,
    agent: pick(AGENTS),
    po,
    record,
    ruleVersion: ruleSet.version,
    checks: result.checks,
    outcome,
    card: outcome === "approved"
      ? {
          cardId: `card_${Math.floor(rand() * 1e12).toString(16)}`,
          last4: String(between(1000, 9999)),
          limitCents: total,
          expiresAt: quoteExpiry,
        }
      : null,
    seeded: true,
  };
}

/**
 * Prior settled payments to the suppliers the negotiation can pick.
 *
 * Rule 10 escalates a first-ever payment to a supplier, which is correct — and it meant
 * that from a clean reset the very first demo run was *held* on a new payee rather than
 * approved, so the run-it-twice moment needed three presses and opened on a rule that had
 * to be explained away.
 *
 * The honest fix is history rather than an exception: a company restocking office supplies
 * has paid its office supplier before. So every vendor the negotiation can settle on gets
 * one prior settled purchase, small and clean, dated before the window the rest of the
 * history covers.
 *
 * Built after the main plan on purpose. The PRNG is shared and consumed in order, so
 * appending here leaves all forty-seven existing rows byte-identical.
 */
function buildPrior(vendor: string, sku: string, unit: number, index: number): Decision {
  const costCentre = pick(COST_CENTRES);
  const quantity = between(2, 8);
  const poNumber = `PO-${3900 + index}`;
  // Comfortably before START, so these read as established history rather than as part of
  // the period the replay diff talks about.
  const observedAt = new Date(START - (index + 1) * 86_400_000 - 3_600_000).toISOString();
  const quoteExpiry = new Date(Date.parse(observedAt) + 21 * 86_400_000).toISOString();

  const quote: QuoteRecord = {
    poNumber,
    status: "accepted",
    fulfilled: true,
    vendor,
    sku,
    unitPrice: unit,
    quantity,
    quoteExpiry,
  };
  const po: PurchaseOrder = { poNumber, vendor, sku, unitPrice: unit, quantity, quoteExpiry, costCentre };

  const quoted = unit * quantity;
  const budget = {
    costCentre,
    limitCents: quoted + 2_000_000,
    spentCents: 0,
  };

  // Verified against the same rules as everything else — nothing is asserted approved.
  const record: RecordSnapshot = { quote: { ...quote, fulfilled: false }, budget, existingCard: null, observedAt };
  const ruleSet = defaultRuleSet();
  const result = verify(po, record, ruleSet);
  if (!result.ok) {
    throw new Error(
      `Prior payment for ${vendor} did not verify clean: ${result.failures.concat(result.escalations).map((c) => c.ruleId).join(", ")}`
    );
  }

  return {
    id: `dec_seed_prior_${String(index).padStart(2, "0")}`,
    createdAt: observedAt,
    agent: pick(AGENTS),
    po,
    record,
    ruleVersion: ruleSet.version,
    checks: result.checks,
    outcome: "approved",
    card: {
      cardId: `card_${Math.floor(rand() * 1e12).toString(16)}`,
      last4: String(between(1000, 9999)),
      limitCents: poTotal(po),
      expiresAt: quoteExpiry,
    },
    seeded: true,
  };
}

const main = PLAN.map(build);

// Derived from the seller roster rather than hardcoded, so a supplier added to a
// negotiation cannot silently reintroduce the first-payment hold on the demo path.
const negotiationVendors = Object.values(SELLERS_BY_TASK)
  .flat()
  .map((s) => ({ vendor: s.vendor, sku: s.sku, unit: s.listPrice }));

const priors = negotiationVendors.map((v, i) => buildPrior(v.vendor, v.sku, v.unit, i));

const decisions = [...main, ...priors].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

const out = join(process.cwd(), "lib", "seed", "decisions.json");
writeFileSync(out, `${JSON.stringify(decisions, null, 2)}\n`);

const count = (o: string) => decisions.filter((d) => d.outcome === o).length;
console.log(`wrote ${decisions.length} decisions to ${out}`);
console.log(`  approved: ${count("approved")}`);
console.log(`  held:     ${count("held")}`);
console.log(`  refused:  ${count("refused")}`);
