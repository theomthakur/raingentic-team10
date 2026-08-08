/**
 * Mandate — core domain types. The join contract between A's half and B's half.
 *
 * Two things matter here and both are design decisions, not incidental shapes:
 *
 *  - A `RuleSet` is versioned DATA. Editing a rule never mutates a version, it creates
 *    the next one. That is what makes replay possible at all.
 *  - A `Decision` stores a SNAPSHOT of the record it read, not a pointer to it. Records
 *    change; replaying a pointer six hours later re-judges today's facts rather than the
 *    facts that were true at decision time.
 */

/** Money is always integer cents. Never floats, never dollars. See lib/money.ts. */
export type Cents = number;

/**
 * The purchase order an agent declares before it is allowed to spend.
 * This is the "why" — the thing Rain's control layer never sees.
 *
 * Produced by A's `proposePurchase()`, consumed by B's `verify()`. Agree any change here
 * across both halves; nothing else is shared.
 */
export interface PurchaseOrder {
  poNumber: string;
  vendor: string;
  sku: string;
  unitPrice: Cents;
  quantity: number;
  /** ISO 8601. The quote is only good until this moment. */
  quoteExpiry: string;
  /** Required: rule 5 has nothing to check a spend against without it. */
  costCentre: string;
}

/** A quote from one seller, before the negotiation picks a winner. A's side. */
export interface VendorQuote {
  vendor: string;
  sku: string;
  unitPrice: Cents;
  quantity: number;
  /** ISO date. */
  validUntil: string;
}

/** The subset of a Rain scoped virtual card A's client returns. */
export interface ScopedCard {
  cardId: string;
  lastFour: string;
  status: "active" | "inactive";
  limitCents: Cents;
  expiresAt: string;
}

/** Total the agent is asking to spend. Derived, never declared, so it cannot be fudged. */
export function poTotal(po: PurchaseOrder): Cents {
  return po.unitPrice * po.quantity;
}

/** The accepted quote as the system of record holds it. */
export interface QuoteRecord {
  poNumber: string;
  status: "accepted" | "draft" | "cancelled";
  fulfilled: boolean;
  vendor: string;
  sku: string;
  unitPrice: Cents;
  quantity: number;
  quoteExpiry: string;
}

export interface BudgetRecord {
  costCentre: string;
  limitCents: Cents;
  spentCents: Cents;
}

export interface IssuedCardRecord {
  cardId: string;
  poNumber: string;
  issuedAt: string;
  /** Set once stage 7 REVOKE runs. A revoked card still blocks re-issuance. */
  revokedAt?: string;
}

/**
 * Everything the checker is allowed to read, captured at one instant.
 * This whole object is what gets stored on the decision — see design decision 4.
 */
export interface RecordSnapshot {
  /** null means the agent declared a PO the system of record has never heard of. */
  quote: QuoteRecord | null;
  budget: BudgetRecord | null;
  /** A card already issued against this PO, if any. Drives idempotency. */
  existingCard: IssuedCardRecord | null;
  /** When the snapshot was taken. */
  observedAt: string;
}

// ---------------------------------------------------------------------------
// Rules as versioned data
// ---------------------------------------------------------------------------

export type RuleId =
  | "po-exists"
  | "po-open"
  | "amount-matches"
  | "line-matches"
  | "within-budget"
  | "no-existing-card";

/** A rule is a row, not an `if`. Params are what a finance team edits without a deploy. */
export interface Rule {
  id: RuleId;
  /** Human label shown in the UI and in refusal text. */
  label: string;
  enabled: boolean;
  params: Record<string, number | boolean | string>;
}

export interface RuleSet {
  version: number;
  createdAt: string;
  /** Free text on why this version exists. Shown in the version history. */
  note: string;
  rules: Rule[];
  /** sha256 over the canonical rules JSON. This is what gets anchored on Monad. */
  hash: string;
  /** Monad testnet tx hash, once anchored. Owned by A, stored here. */
  anchorTxHash?: string;
}

// ---------------------------------------------------------------------------
// Check results and decisions
// ---------------------------------------------------------------------------

/**
 * One check's verdict. The four provenance fields are deliberate: a judge clicking a
 * refusal sees the rule that failed, what it expected, what it got, and where it read.
 */
export interface CheckResult {
  ruleId: RuleId;
  label: string;
  passed: boolean;
  /** Plain English, actionable. Never "validation failed". */
  reason: string;
  expected: string;
  actual: string;
  /** Which part of the record snapshot this check read, e.g. "record.quote.vendor". */
  readFrom: string;
  /** true when the rule was disabled in this version, so it did not run. */
  skipped?: boolean;
}

export interface VerifyResult {
  ok: boolean;
  checks: CheckResult[];
  failures: CheckResult[];
}

export type Outcome = "approved" | "refused";

/** One immutable row in the append-only log. Nothing here is ever updated in place. */
export interface Decision {
  id: string;
  createdAt: string;
  po: PurchaseOrder;
  /** The snapshot, not a pointer. This is what replay re-judges. */
  record: RecordSnapshot;
  ruleVersion: number;
  checks: CheckResult[];
  outcome: Outcome;
  /** Present only when the outcome was approved and Rain actually issued. */
  card?: { cardId: string; last4: string; limitCents: Cents; expiresAt: string } | null;
  /** True for rows written by the seed script rather than a live run. */
  seeded?: boolean;
  /** Which agent produced the PO. Cosmetic, but makes the feed read like a real system. */
  agent: string;
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

export interface ReplayChange {
  decisionId: string;
  poNumber: string;
  vendor: string;
  totalCents: Cents;
  before: Outcome;
  after: Outcome;
  /** The checks that differ between the two runs, for the drill-down. */
  nowFailing: CheckResult[];
  nowPassing: CheckResult[];
}

export interface ReplayResult {
  fromVersion: number;
  toVersion: number;
  total: number;
  unchanged: number;
  approvedNowRefused: ReplayChange[];
  refusedNowApproved: ReplayChange[];
}
