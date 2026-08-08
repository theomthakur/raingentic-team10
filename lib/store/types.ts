import type {
  BudgetRecord,
  Decision,
  IssuedCardRecord,
  PurchaseOrder,
  QuoteRecord,
  RecordSnapshot,
  RuleSet,
  SpendHistory,
} from "@/lib/types";

/**
 * Every driver implements this. The interface is async throughout so that swapping the
 * in-memory driver for Postgres is invisible to everything above it.
 */
export interface Store {
  readonly kind: "memory" | "postgres";

  // --- rule versions (append-only, never mutated) -------------------------
  listRuleSets(): Promise<RuleSet[]>;
  getRuleSet(version: number): Promise<RuleSet | null>;
  /**
   * The version that actually decides things: the highest **active** one. A pending
   * version has been written down but not yet activated by a second person, and until
   * then it must not affect a single purchase.
   */
  latestRuleSet(): Promise<RuleSet>;
  appendRuleSet(ruleSet: RuleSet): Promise<RuleSet>;
  /** Replace a pending version with its activated self. */
  activateRuleSet(ruleSet: RuleSet): Promise<void>;
  setAnchor(version: number, txHash: string): Promise<void>;

  // --- decision log (append-only, never mutated) --------------------------
  listDecisions(): Promise<Decision[]>;
  appendDecision(decision: Decision): Promise<Decision>;

  // --- the system of record ----------------------------------------------
  getQuote(poNumber: string): Promise<QuoteRecord | null>;
  getBudget(costCentre: string): Promise<BudgetRecord | null>;
  getCardForPO(poNumber: string): Promise<IssuedCardRecord | null>;

  /**
   * Aggregates over recent decisions, for the rules that judge a purchase in the context
   * of the ones around it rather than on its own.
   *
   * Derived from the decision log itself rather than a separate counter, so it cannot
   * drift out of step with what was actually decided.
   */
  getSpendHistory(params: {
    agent: string;
    vendor: string;
    costCentre: string;
    windowHours: number;
    /**
     * The order line being judged, excluded from every aggregate.
     *
     * Without this a purchase is counted against itself. A held purchase still counts as
     * exposure — correctly, since it is pending a signature rather than abandoned — so when
     * a person releases it, the held row for that same order line is already in the totals
     * and the release adds the amount a second time. A $43,500 purchase looked like $87,000
     * and was refused on velocity, which read as the system contradicting its own approval.
     *
     * The same order line is one obligation, however many rows it has generated. Whether it
     * has already been paid is rule 6's job, not the rate limit's.
     */
    excludePoNumber?: string;
  }): Promise<SpendHistory>;

  /**
   * A negotiation concluded, so the winning quote becomes an accepted order line on the
   * record. This is what gives the agent something to be checked *against* — without it
   * the checker would be comparing the agent's declaration to itself.
   *
   * Deliberately does not overwrite an existing line: once an order line exists, a later
   * run of the same task must be judged against the original terms, not against terms the
   * retry brought with it. That is what keeps the run-it-twice refusal honest.
   */
  recordAcceptedQuote(quote: QuoteRecord): Promise<void>;

  /**
   * The write-back that makes the run-it-twice demo real rather than staged. Once a card
   * exists against a PO, the next identical run reads it and rule 6 refuses.
   */
  /**
   * Atomically reserve an order line for issuance. Returns false if someone else already
   * holds it.
   *
   * Rule 6 alone is not enough under concurrency: two identical requests both take their
   * snapshot before either writes a card, so both see "no card yet" and both issue. The
   * check is honest about what it read — it just read it a moment too early. This closes
   * that window, and it is the difference between idempotency as a claim and idempotency
   * as a property.
   */
  claimOrderLine(poNumber: string): Promise<boolean>;
  /** Give the line back when issuance failed, so a retry is not locked out forever. */
  releaseOrderLine(poNumber: string): Promise<void>;

  recordIssuedCard(card: IssuedCardRecord): Promise<void>;
  chargeBudget(costCentre: string, cents: number): Promise<void>;
  markFulfilled(poNumber: string): Promise<void>;
  revokeCard(poNumber: string, at: string): Promise<void>;

  /** Demo reset. Clears live rows and restores fixtures; seeded history is untouched. */
  reset(): Promise<void>;
}

/**
 * Take the snapshot the checker is allowed to see. Design decision 4: what gets stored on
 * the decision is this object, not the ids inside it.
 */
export async function snapshot(
  store: Store,
  po: PurchaseOrder,
  agent: string,
  /** Trailing window the history rules judge against. One business day by default. */
  windowHours = 24
): Promise<RecordSnapshot> {
  const [quote, budget, existingCard, history] = await Promise.all([
    store.getQuote(po.poNumber),
    store.getBudget(po.costCentre),
    store.getCardForPO(po.poNumber),
    store.getSpendHistory({
      agent,
      vendor: po.vendor,
      costCentre: po.costCentre,
      windowHours,
      excludePoNumber: po.poNumber,
    }),
  ]);
  return {
    quote,
    budget,
    existingCard,
    agent,
    history,
    observedAt: new Date().toISOString(),
  };
}
