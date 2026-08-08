import type { Rule, RuleSet } from "@/lib/types";
import { hashRules } from "./hash";

/**
 * Rule version 1. Six rules, all data.
 *
 * Nothing in `lib/checks` hardcodes any of these numbers — a check reads its thresholds
 * out of `params`. That is the whole difference between a policy a customer owns and a
 * policy buried in a deploy.
 */
export const DEFAULT_RULES: Rule[] = [
  {
    id: "po-exists",
    label: "PO exists and is accepted",
    enabled: true,
    params: { requireAccepted: true },
  },
  {
    id: "po-open",
    label: "PO still open and the quote has not expired",
    enabled: true,
    params: { allowExpiredQuote: false, expiryGraceHours: 0 },
  },
  {
    id: "amount-matches",
    label: "Amount matches the accepted quote",
    enabled: true,
    // 200 bps = 2%. Tightening this to 0 is the rule edit the replay demo uses.
    params: { toleranceBps: 200 },
  },
  {
    id: "line-matches",
    label: "Vendor and SKU match the accepted quote",
    enabled: true,
    params: { checkVendor: true, checkSku: true, caseSensitive: false },
  },
  {
    id: "within-budget",
    label: "Within the cost centre's remaining budget",
    enabled: true,
    params: { blockOnMissingBudget: true },
  },
  {
    id: "no-existing-card",
    label: "No card already issued for this PO",
    enabled: true,
    // A revoked card still counts: the obligation was already met once.
    params: { countRevoked: true },
  },
];

export function defaultRuleSet(): RuleSet {
  return {
    version: 1,
    createdAt: new Date("2026-08-08T09:00:00.000Z").toISOString(),
    note: "Initial policy",
    rules: DEFAULT_RULES,
    hash: hashRules(DEFAULT_RULES),
  };
}

/** Build the next version from an edited rule list. The old version is never touched. */
export function nextRuleSet(previous: RuleSet, rules: Rule[], note: string): RuleSet {
  return {
    version: previous.version + 1,
    createdAt: new Date().toISOString(),
    note: note || `Revision of v${previous.version}`,
    rules,
    hash: hashRules(rules),
  };
}
