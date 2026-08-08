import type { Decision, ReplayChange, ReplayResult, RuleSet } from "@/lib/types";
import { poTotal } from "@/lib/types";
import { verify } from "@/lib/checks";

/**
 * Replay every past decision against a different rule version.
 *
 * This is only honest because of two decisions made earlier:
 *
 *  - Each decision stored a SNAPSHOT of the record it read, not a pointer. Re-reading the
 *    live record would re-judge today's facts, which is a new decision, not a replay.
 *  - `verify` is deterministic with no model and no wall clock, so any difference in the
 *    outcome can only have come from the rule change.
 *
 * It is also cheap: the checks are pure functions over rows we already have, so this is a
 * loop, not a rebuild.
 */
export function replay(decisions: Decision[], target: RuleSet): ReplayResult {
  const approvedNowRefused: ReplayChange[] = [];
  const refusedNowApproved: ReplayChange[] = [];
  let unchanged = 0;

  for (const decision of decisions) {
    const after = verify(decision.po, decision.record, target);
    const outcome = after.ok ? "approved" : "refused";

    if (outcome === decision.outcome) {
      unchanged++;
      continue;
    }

    const beforeById = new Map(decision.checks.map((c) => [c.ruleId, c]));
    const afterById = new Map(after.checks.map((c) => [c.ruleId, c]));
    const beforeFailing = new Set(
      decision.checks.filter((c) => !c.passed).map((c) => c.ruleId)
    );
    const afterFailing = new Set(after.failures.map((c) => c.ruleId));

    const change: ReplayChange = {
      decisionId: decision.id,
      poNumber: decision.po.poNumber,
      vendor: decision.po.vendor,
      totalCents: poTotal(decision.po),
      before: decision.outcome,
      after: outcome,
      // Each flip carries both sides, so the UI can say "this passed within a 2%
      // tolerance and now it doesn't" rather than only naming the rule.
      nowFailing: after.failures
        .filter((c) => !beforeFailing.has(c.ruleId))
        .map((now) => ({ now, previously: beforeById.get(now.ruleId) })),
      nowPassing: decision.checks
        .filter((c) => !c.passed && !afterFailing.has(c.ruleId))
        .map((previously) => ({
          now: afterById.get(previously.ruleId) ?? previously,
          previously,
        })),
    };

    if (decision.outcome === "approved") approvedNowRefused.push(change);
    else refusedNowApproved.push(change);
  }

  const fromVersion = decisions.length
    ? Math.max(...decisions.map((d) => d.ruleVersion))
    : target.version;

  return {
    fromVersion,
    toVersion: target.version,
    total: decisions.length,
    unchanged,
    approvedNowRefused,
    refusedNowApproved,
  };
}
