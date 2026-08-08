import type { Rule, RuleSet } from "@/lib/types";
import { hashRules } from "./hash";

/**
 * Rule version 1. Seven rules, all data.
 *
 * Nothing in `lib/checks` hardcodes any of these numbers — a check reads its thresholds
 * out of `params`. That is the whole difference between a policy a customer owns and a
 * policy buried in a deploy.
 *
 * Every rule carries a `basis`: the real-world control it implements. None of these were
 * invented here. That is deliberate, and it is most of the answer to "why should I trust
 * software to spend my money?" — because these are the controls your finance team already
 * runs, moved to before the money is committed. See docs/CONTROLS.md.
 */
export const DEFAULT_RULES: Rule[] = [
  {
    id: "po-exists",
    label: "PO exists and is accepted",
    enabled: true,
    params: { requireAccepted: true },
    basis: "Three-way match, PO leg — accounts payable will not pay against an order that was never raised",
  },
  {
    id: "po-open",
    label: "PO still open and the quote has not expired",
    enabled: true,
    params: { allowExpiredQuote: false, expiryGraceHours: 0 },
    basis: "Three-way match, receipt leg — a fulfilled line must not be paid twice",
  },
  {
    id: "amount-matches",
    label: "Amount matches the accepted quote",
    enabled: true,
    // 200 bps = 2%. Tightening this to 0 is the rule edit the replay demo uses.
    params: { toleranceBps: 200 },
    basis: "Three-way match, invoice leg — price variance tolerance, as ERPs apply on invoice matching",
  },
  {
    id: "line-matches",
    label: "Vendor and SKU match the accepted quote",
    enabled: true,
    params: { checkVendor: true, checkSku: true, caseSensitive: false },
    basis: "Line-level match — no card network can express 'right supplier, wrong item', because an issuer cannot see your order system",
  },
  {
    id: "within-budget",
    label: "Within the cost centre's remaining budget",
    enabled: true,
    params: { blockOnMissingBudget: true },
    basis: "Budgetary control — commitment accounting against a cost centre",
  },
  {
    id: "no-existing-card",
    label: "No card already issued for this PO",
    enabled: true,
    // A revoked card still counts: the obligation was already met once.
    params: { countRevoked: true },
    basis: "Idempotency key — in payments a retry is not hypothetical, and the order line is the key",
  },
  {
    id: "requires-approval",
    label: "Above the delegated limit, a person must release it",
    enabled: true,
    // $25,000. Routine procurement runs unattended; capital-sized purchases wait for a
    // named human. Set it too low and nobody reads the queue, which is worse than no
    // control at all.
    params: { thresholdCents: 2_500_000, approverRole: "finance-controller" },
    basis: "Delegation of authority — bounded autonomy with an escalation path, exactly as a DoA matrix grants it to a person",
  },
];

export function defaultRuleSet(): RuleSet {
  return {
    version: 1,
    createdAt: new Date("2026-08-08T09:00:00.000Z").toISOString(),
    note: "Initial policy",
    rules: DEFAULT_RULES,
    hash: hashRules(DEFAULT_RULES),
    // The baseline policy is active by definition — there was nothing before it to
    // segregate duties against.
    status: "active",
    proposedBy: "system",
    approvedBy: "system",
    approvedAt: new Date("2026-08-08T09:00:00.000Z").toISOString(),
  };
}

/**
 * Build the next version from an edited rule list. The old version is never touched, and
 * the new one starts **pending** — it does not decide anything until someone other than
 * its author activates it.
 */
export function nextRuleSet(
  previous: RuleSet,
  rules: Rule[],
  note: string,
  proposedBy = "unattributed"
): RuleSet {
  return {
    version: previous.version + 1,
    createdAt: new Date().toISOString(),
    note: note || `Revision of v${previous.version}`,
    rules,
    hash: hashRules(rules),
    status: "pending",
    proposedBy,
  };
}

/** Activate a pending version. The author may not be the approver. */
export function activateRuleSet(pending: RuleSet, approvedBy: string): RuleSet {
  if (pending.status === "active") {
    throw new Error(`Policy v${pending.version} is already active.`);
  }
  if (approvedBy.trim().toLowerCase() === pending.proposedBy.trim().toLowerCase()) {
    throw new Error(
      `${pending.proposedBy} proposed v${pending.version} and cannot also approve it. That is the point of the control.`
    );
  }
  return {
    ...pending,
    status: "active",
    approvedBy: approvedBy.trim(),
    approvedAt: new Date().toISOString(),
  };
}
