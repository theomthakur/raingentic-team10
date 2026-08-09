import type { RuleId } from "@/lib/types";

/**
 * The real-world control each rule implements — the single source of truth for it.
 *
 * **Why this is its own module with no imports.** `defaults.ts` pulls in `hash.ts`, which
 * needs `node:crypto`, so a client component that imported the basis from there would drag
 * the whole hashing path into the browser bundle and fail the build. These are plain
 * strings with no dependencies, so both the server-side rule data and the client-side
 * provenance panel can read them from one place rather than duplicating them.
 *
 * **Why it matters at all.** None of these rules were invented for this project. Each one
 * names an established control that finance teams already run, which is most of the honest
 * answer to "why should I trust software to spend my money?" — the answer is not "our rules
 * are clever", it is "these are your controls, moved to before the money is committed."
 *
 * The basis text is intentionally kept with the code so the public repository remains
 * self-contained.
 */
export const RULE_BASIS: Record<RuleId, string> = {
  "po-exists":
    "Three-way match, PO leg — accounts payable will not pay against an order that was never raised",
  "po-open":
    "Three-way match, receipt leg — a fulfilled line must not be paid twice",
  "amount-matches":
    "Three-way match, invoice leg — price variance tolerance, as ERPs apply on invoice matching",
  "line-matches":
    "Line-level match — no card network can express 'right supplier, wrong item', because an issuer cannot see your order system",
  "within-budget": "Budgetary control — commitment accounting against a cost centre",
  "no-existing-card":
    "Idempotency key — in payments a retry is not hypothetical, and the order line is the key",
  "requires-approval":
    "Delegation of authority — bounded autonomy with an escalation path, exactly as a DoA matrix grants it to a person",

  // The history-aware four. Each of these reads the decision log rather than a single
  // declaration, which is why they could only exist once the log did — and each is a
  // named control, not an invention.
  "no-structuring":
    "Structuring detection — banks have flagged deliberately-split transactions since the Bank Secrecy Act; the same logic applies to an agent splitting a purchase order",
  "agent-authority":
    "Role-based delegation of authority — a junior buyer and a capital buyer do not share a signing limit",
  "known-vendor":
    "New-payee verification — the control every AP team runs, because invoice fraud almost always arrives as a payee nobody has paid before",
  "velocity":
    "Velocity limiting — standard card-fraud control, applied to the agent rather than the card",
};

/**
 * The control a rule descends from, by id.
 *
 * Looked up from the rule's identity rather than stored on each `CheckResult`, because the
 * basis is a property of *what the rule is*, not of what it decided on one occasion. A
 * version changes thresholds and which rules are enabled, never the control a rule
 * implements, so this stays correct for a decision replayed against any version.
 */
export function basisFor(ruleId: string): string | undefined {
  return RULE_BASIS[ruleId as RuleId];
}
