import type { Rule } from "@/lib/types";

/**
 * What changed between two rule versions.
 *
 * Naming the exact parameter that moved is what turns "8 approvals would now be refused"
 * from a number into an explanation. Without it a judge has to take the diff on trust.
 */
export interface RuleChange {
  ruleId: string;
  label: string;
  /** e.g. "toleranceBps", or "enabled" when the rule was switched on or off. */
  field: string;
  before: string;
  after: string;
}

function show(value: unknown): string {
  if (typeof value === "boolean") return value ? "on" : "off";
  if (value === undefined) return "—";
  return String(value);
}

export function diffRules(before: Rule[], after: Rule[]): RuleChange[] {
  const beforeById = new Map(before.map((r) => [r.id, r]));
  const changes: RuleChange[] = [];

  for (const rule of after) {
    const prev = beforeById.get(rule.id);
    if (!prev) continue;

    if (prev.enabled !== rule.enabled) {
      changes.push({
        ruleId: rule.id,
        label: rule.label,
        field: "enabled",
        before: show(prev.enabled),
        after: show(rule.enabled),
      });
    }

    // Union of both sides, so a parameter that was added or removed still shows up.
    const keys = new Set([...Object.keys(prev.params), ...Object.keys(rule.params)]);
    for (const key of keys) {
      if (prev.params[key] !== rule.params[key]) {
        changes.push({
          ruleId: rule.id,
          label: rule.label,
          field: key,
          before: show(prev.params[key]),
          after: show(rule.params[key]),
        });
      }
    }
  }

  return changes;
}
