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
  /** Who declared it. Needed by the rules that vary authority by agent. */
  agent?: string;
  /**
   * What has already been spent around this purchase.
   *
   * Optional because the 47 seeded decisions were written before these rules existed, and
   * a replay must never invent history it did not capture — the rules that read this skip
   * cleanly when it is absent rather than guessing.
   */
  history?: SpendHistory;
}

/**
 * Aggregates over the recent decision log, computed at snapshot time and frozen with the
 * decision.
 *
 * Deliberately aggregates rather than a list of rows: a check must stay a pure function
 * over a small, stable input, and storing every prior decision inside every decision
 * would make the log grow quadratically.
 */
export interface SpendHistory {
  /** How far back the counts below reach. */
  windowHours: number;
  /** Everything this agent had approved or held in the window, before this purchase. */
  agentCount: number;
  agentTotalCents: Cents;
  /**
   * Spend already committed to this same vendor and cost centre in the window. This is
   * what makes a split purchase visible: each half is small, the pair is not.
   */
  sameVendorCostCentreCents: Cents;
  sameVendorCostCentreCount: number;
  /** False when nobody has ever successfully paid this vendor before. */
  vendorEverPaid: boolean;
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
  | "no-existing-card"
  | "requires-approval"
  | "no-structuring"
  | "agent-authority"
  | "known-vendor"
  | "velocity";

/** A rule is a row, not an `if`. Params are what a finance team edits without a deploy. */
export interface Rule {
  id: RuleId;
  /** Human label shown in the UI and in refusal text. */
  label: string;
  enabled: boolean;
  params: Record<string, number | boolean | string>;
  /**
   * The real-world control this implements. None of these rules were invented here — they
   * are controls finance departments already run, moved to before the money is committed.
   * Saying so is most of the answer to "why should I trust this?".
   */
  basis: string;
}

/**
 * A version is proposed by one person and activated by another.
 *
 * Editing the rules is the most powerful action in the system — whoever can raise a
 * threshold can approve anything. Without a second pair of eyes, the honest criticism of
 * replay is "you can change the rules, so the audit proves nothing". Segregation of duties
 * is the standard answer, and it is what makes the version history worth trusting.
 */
export type RuleSetStatus = "pending" | "active";

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

  status: RuleSetStatus;
  /** Who wrote the change. Cannot be the same person who activates it. */
  proposedBy: string;
  approvedBy?: string;
  approvedAt?: string;
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
  /**
   * This check did not reject the purchase — it escalated it to a person.
   *
   * The distinction matters: a refusal means the purchase was wrong, a hold means it was
   * merely large enough that a human should look. Conflating the two would either block
   * legitimate spending or wave through the thing you most wanted a person to see.
   */
  escalates?: boolean;
}

export interface VerifyResult {
  /** Nothing blocked and nothing escalated: safe to issue immediately. */
  ok: boolean;
  checks: CheckResult[];
  /** Hard failures. Any of these and the purchase is wrong, not merely large. */
  failures: CheckResult[];
  /** Rules that want a human to look before an instrument exists. */
  escalations: CheckResult[];
}

/**
 * `held` means every check passed but the amount crossed the delegated authority limit,
 * so no card exists until a named person releases it. It is not a failure — it is the
 * escalation path every delegation-of-authority matrix already has for humans.
 */
export type Outcome = "approved" | "refused" | "held";

/** Who released a held purchase, when, and why. Written as its own append-only row. */
export interface Approval {
  by: string;
  at: string;
  note: string;
  /** The decision this releases. */
  decisionId: string;
}

/**
 * How the price on this PO was arrived at.
 *
 * Recorded, never checked. The checks read the record, not the story behind it — a
 * seller's reasoning is not evidence. But "where did this number come from" is a fair
 * audit question, and storing the answer alongside the decision means it can be answered
 * six months later without re-deriving anything.
 */
export interface NegotiationSummary {
  taskKey: string;
  buyerTargetCents: Cents;
  roundCount: number;
  offers: {
    vendor: string;
    strategy: string;
    label: string;
    opening: Cents;
    final: Cents;
    note: string;
    won: boolean;
  }[];
}

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
  card?: {
    cardId: string;
    last4: string;
    limitCents: Cents;
    expiresAt: string;
    /**
     * A real Rain sandbox authorization and settlement, if this run was configured to
     * exercise the scoped card. This is deliberately separate from Mandate's own budget
     * write-back: a Rain transaction id is evidence that the card lifecycle happened.
     */
    rainSettlement?: {
      transactionId: string;
      status: "settled";
      amountCents: Cents;
      merchantName: string;
      merchantCategoryCode: string;
    };
  } | null;
  /** True for rows written by the seed script rather than a live run. */
  seeded?: boolean;
  /** Which agent produced the PO. Cosmetic, but makes the feed read like a real system. */
  agent: string;
  /** Present when this PO came out of a negotiation rather than a fixed quote. */
  negotiation?: NegotiationSummary;
  /**
   * Set when a held decision was later released by a person. The original row is never
   * mutated — this is written on the follow-up row, so the log shows both the hold and
   * who lifted it.
   */
  approval?: Approval;
  /** For a release row: the held decision it followed from. */
  releases?: string;
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

/**
 * One rule whose verdict moved, with both sides of the comparison.
 *
 * Keeping the previous verdict alongside the new one is what lets the UI say "this used
 * to pass, within a 2% tolerance, and now it doesn't, because the tolerance is 0" rather
 * than just naming the rule. The before/after pair is the whole explanation.
 */
export interface ReplayFlip {
  /** The rule's verdict under the version being replayed. */
  now: CheckResult;
  /** The same rule's verdict at the time the decision was originally made. */
  previously?: CheckResult;
}

export interface ReplayChange {
  decisionId: string;
  poNumber: string;
  vendor: string;
  totalCents: Cents;
  before: Outcome;
  after: Outcome;
  /** The checks that differ between the two runs, for the drill-down. */
  nowFailing: ReplayFlip[];
  nowPassing: ReplayFlip[];
}

export interface ReplayResult {
  fromVersion: number;
  toVersion: number;
  total: number;
  unchanged: number;
  approvedNowRefused: ReplayChange[];
  refusedNowApproved: ReplayChange[];
}
