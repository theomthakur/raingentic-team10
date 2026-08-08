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
  /** Order lines currently reserved for issuance. */
  claims: Set<string>;
}

function freshState(): State {
  return {
    ruleSets: [defaultRuleSet()],
    decisions: (seededDecisions as unknown as Decision[]).map((d) => ({ ...d, seeded: true })),
    quotes: SEED_QUOTES.map((q) => ({ ...q })),
    budgets: SEED_BUDGETS.map((b) => ({ ...b })),
    cards: [],
    claims: new Set<string>(),
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
      // Active only. A pending version decides nothing until a second person activates it.
      const active = state().ruleSets.filter((r) => r.status === "active");
      return active.reduce((a, b) => (b.version > a.version ? b : a));
    },
    async appendRuleSet(ruleSet) {
      state().ruleSets.push(ruleSet);
      return ruleSet;
    },
    async activateRuleSet(ruleSet) {
      const i = state().ruleSets.findIndex((r) => r.version === ruleSet.version);
      if (i >= 0) state().ruleSets[i] = ruleSet;
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

    /**
     * Read straight off the decision log.
     *
     * Two different questions, and they need two different filters:
     *
     * **Exposure** — the rate and structuring rules ask "how much is this agent committing
     * right now". Approved *and* held rows both count, because a held purchase is pending a
     * signature rather than abandoned, and ignoring the hold queue would let an agent
     * structure a purchase through it. A refusal never moved money, so counting it would
     * punish an agent for the system correctly stopping it.
     *
     * **Payment history** — rule 10 asks "have we ever actually paid this supplier". Only
     * an approved row answers yes. A held purchase has paid nobody, and counting it made
     * the control defeat itself: the first attempt was held for review, and that hold alone
     * made the vendor "known" so a retry sailed through with no human involved.
     */
    async getSpendHistory({ agent, vendor, costCentre, windowHours, excludePoNumber }) {
      const cutoff = Date.now() - windowHours * 3_600_000;
      // The order line being judged is excluded from every aggregate, or a purchase is
      // counted against itself: a held row for this same line is already in the totals
      // when a person releases it, so the release would add the amount twice.
      const all = (await this.listDecisions()).filter(
        (d) => !excludePoNumber || d.po.poNumber !== excludePoNumber
      );
      const committed = all.filter((d) => d.outcome === "approved" || d.outcome === "held");
      const settled = all.filter((d) => d.outcome === "approved");
      const inWindow = committed.filter((d) => Date.parse(d.createdAt) >= cutoff);

      const mine = inWindow.filter((d) => d.agent === agent);
      const sameLine = inWindow.filter(
        (d) => d.po.vendor === vendor && d.po.costCentre === costCentre
      );
      const total = (rows: typeof inWindow) =>
        rows.reduce((sum, d) => sum + d.po.unitPrice * d.po.quantity, 0);

      return {
        windowHours,
        agentCount: mine.length,
        agentTotalCents: total(mine),
        sameVendorCostCentreCents: total(sameLine),
        sameVendorCostCentreCount: sameLine.length,
        // Across all time, not just the window: a vendor paid two years ago is not new.
        // `settled`, not `committed` — a hold has paid nobody, and treating it as payment
        // let a retry clear this control without anyone approving anything.
        vendorEverPaid: settled.some((d) => d.po.vendor === vendor),
      };
    },

    async recordAcceptedQuote(quote) {
      const existing = state().quotes.find((x) => x.poNumber === quote.poNumber);
      if (existing) return; // first terms win, see the interface note
      state().quotes.push({ ...quote });
    },

    async claimOrderLine(poNumber) {
      // No await between the check and the set, so this is atomic on JS's single thread.
      // An await here would reopen exactly the window it exists to close.
      if (state().claims.has(poNumber)) return false;
      state().claims.add(poNumber);
      return true;
    },
    async releaseOrderLine(poNumber) {
      state().claims.delete(poNumber);
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
