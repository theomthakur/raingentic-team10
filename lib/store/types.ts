import type {
  BudgetRecord,
  Decision,
  IssuedCardRecord,
  PurchaseOrder,
  QuoteRecord,
  RecordSnapshot,
  RuleSet,
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
  latestRuleSet(): Promise<RuleSet>;
  appendRuleSet(ruleSet: RuleSet): Promise<RuleSet>;
  setAnchor(version: number, txHash: string): Promise<void>;

  // --- decision log (append-only, never mutated) --------------------------
  listDecisions(): Promise<Decision[]>;
  appendDecision(decision: Decision): Promise<Decision>;

  // --- the system of record ----------------------------------------------
  getQuote(poNumber: string): Promise<QuoteRecord | null>;
  getBudget(costCentre: string): Promise<BudgetRecord | null>;
  getCardForPO(poNumber: string): Promise<IssuedCardRecord | null>;

  /**
   * The write-back that makes the run-it-twice demo real rather than staged. Once a card
   * exists against a PO, the next identical run reads it and rule 6 refuses.
   */
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
export async function snapshot(store: Store, po: PurchaseOrder): Promise<RecordSnapshot> {
  const [quote, budget, existingCard] = await Promise.all([
    store.getQuote(po.poNumber),
    store.getBudget(po.costCentre),
    store.getCardForPO(po.poNumber),
  ]);
  return { quote, budget, existingCard, observedAt: new Date().toISOString() };
}
