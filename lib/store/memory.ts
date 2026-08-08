import type {
  BudgetRecord,
  Decision,
  IssuedCardRecord,
  QuoteRecord,
  RuleSet,
} from "@/lib/types";
import { defaultRuleSet } from "@/lib/rules/defaults";
import { SEED_BUDGETS, SEED_QUOTES } from "@/lib/fixtures/records";
import seededDecisions from "@/lib/seed/decisions.json";
import type { Store } from "./types";

interface State {
  ruleSets: RuleSet[];
  decisions: Decision[];
  quotes: QuoteRecord[];
  budgets: BudgetRecord[];
  cards: IssuedCardRecord[];
}

function freshState(): State {
  return {
    ruleSets: [defaultRuleSet()],
    decisions: (seededDecisions as unknown as Decision[]).map((d) => ({ ...d, seeded: true })),
    quotes: SEED_QUOTES.map((q) => ({ ...q })),
    budgets: SEED_BUDGETS.map((b) => ({ ...b })),
    cards: [],
  };
}

/**
 * Next.js dev recompiles modules on every edit, and a plain module-level `let` would drop
 * the log on each save. Hanging it off globalThis keeps the demo's history across HMR.
 */
const g = globalThis as unknown as { __mandateState?: State };
function state(): State {
  if (!g.__mandateState) g.__mandateState = freshState();
  return g.__mandateState;
}

export function createMemoryStore(): Store {
  return {
    kind: "memory",

    async listRuleSets() {
      return [...state().ruleSets].sort((a, b) => a.version - b.version);
    },
    async getRuleSet(version) {
      return state().ruleSets.find((r) => r.version === version) ?? null;
    },
    async latestRuleSet() {
      const all = state().ruleSets;
      return all.reduce((a, b) => (b.version > a.version ? b : a));
    },
    async appendRuleSet(ruleSet) {
      state().ruleSets.push(ruleSet);
      return ruleSet;
    },
    async setAnchor(version, txHash) {
      const rs = state().ruleSets.find((r) => r.version === version);
      // The anchor is provenance about the version, not part of the hashed policy itself,
      // so attaching it does not mutate what the version means.
      if (rs) rs.anchorTxHash = txHash;
    },

    async listDecisions() {
      return [...state().decisions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    async appendDecision(decision) {
      state().decisions.push(decision);
      return decision;
    },

    async getQuote(poNumber) {
      const q = state().quotes.find((x) => x.poNumber === poNumber);
      return q ? { ...q } : null;
    },
    async getBudget(costCentre) {
      const b = state().budgets.find((x) => x.costCentre === costCentre);
      return b ? { ...b } : null;
    },
    async getCardForPO(poNumber) {
      const c = state().cards.find((x) => x.poNumber === poNumber);
      return c ? { ...c } : null;
    },

    async recordAcceptedQuote(quote) {
      const existing = state().quotes.find((x) => x.poNumber === quote.poNumber);
      if (existing) return; // first terms win, see the interface note
      state().quotes.push({ ...quote });
    },

    async recordIssuedCard(card) {
      state().cards.push({ ...card });
    },
    async chargeBudget(costCentre, cents) {
      const b = state().budgets.find((x) => x.costCentre === costCentre);
      if (b) b.spentCents += cents;
    },
    async markFulfilled(poNumber) {
      const q = state().quotes.find((x) => x.poNumber === poNumber);
      if (q) q.fulfilled = true;
    },
    async revokeCard(poNumber, at) {
      const c = state().cards.find((x) => x.poNumber === poNumber);
      if (c) c.revokedAt = at;
    },

    async reset() {
      g.__mandateState = freshState();
    },
  };
}
