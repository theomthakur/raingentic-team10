import type { Decision } from "@/lib/types";

/**
 * The scoreboard for "beat the checks".
 *
 * Derived from the append-only log rather than kept as a separate tally. A counter that
 * increments alongside the decisions it counts can drift from them, and the one number
 * this project cannot afford to have doubted is the one that says nobody has beaten it.
 * Computed from the record, it is checkable: every attempt is a row you can open.
 */

/** Attempts arrive tagged, so a judge's attack is never confused with a demo task. */
export const CHALLENGER = "challenger";

export interface ChallengeStats {
  attempts: number;
  /** Attempts that got a card for an order the record does not support. */
  defeats: number;
  /** Distinct rules that have stopped at least one attempt. */
  rulesTriggered: string[];
}

/**
 * Did this purchase order differ from what was actually quoted?
 *
 * Deliberately compares against the snapshot the decision itself stored, not today's
 * records — the same discipline replay uses. A missing quote counts as deviation: an
 * invented purchase order is the most obvious attack there is.
 */
export function deviatesFromRecord(decision: Decision): boolean {
  const quote = decision.record.quote;
  if (!quote) return true;

  const norm = (s: string) => s.trim().toLowerCase();
  return (
    norm(decision.po.vendor) !== norm(quote.vendor) ||
    norm(decision.po.sku) !== norm(quote.sku) ||
    decision.po.unitPrice !== quote.unitPrice ||
    decision.po.quantity !== quote.quantity
  );
}

export function challengeStats(decisions: Decision[]): ChallengeStats {
  const attempts = decisions.filter((d) => d.agent === CHALLENGER);
  const triggered = new Set<string>();

  for (const a of attempts) {
    for (const c of a.checks) {
      if (!c.passed && !c.skipped) triggered.add(c.ruleId);
    }
  }

  return {
    attempts: attempts.length,
    // A refusal is the check working. A defeat is a card that exists for an order the
    // record does not support — a deliberately hard bar, and the only one worth counting.
    defeats: attempts.filter((d) => d.outcome === "approved" && deviatesFromRecord(d)).length,
    rulesTriggered: [...triggered],
  };
}


/**
 * How many real Rain cards this system has actually issued.
 *
 * The live badge used to read off an in-process flag, which meant a serverless instance
 * that had just woken up reported "simulated" while fifty real Rain cards sat in the
 * database. On a project whose whole argument is that it does not overstate, understating
 * on the first screen is its own kind of dishonesty — and this is the one number worth
 * being loud about.
 *
 * Counted from the log for the same reason the challenge scoreboard is: a number derived
 * from the record can be opened and checked, and cannot drift from what it counts.
 * Simulated cards carry a `sim_` id, so the two are told apart by what was actually
 * written rather than by what a flag remembers.
 */
export function realCardsIssued(decisions: Decision[]): number {
  return decisions.filter((d) => d.card && !d.card.cardId.startsWith("sim_")).length;
}
