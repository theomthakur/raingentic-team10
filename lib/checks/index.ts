import type {
  CheckResult,
  PurchaseOrder,
  RecordSnapshot,
  Rule,
  RuleId,
  RuleSet,
  VerifyResult,
} from "@/lib/types";
import { poTotal } from "@/lib/types";
import { money } from "@/lib/format";

/**
 * The eleven checks.
 *
 * Three properties hold for every function in this file, and all three are load-bearing:
 *
 *  1. No I/O. A check reads its arguments and nothing else.
 *  2. No model. There is no LLM anywhere in this path, which is exactly why a replay of
 *     history is meaningful — the same inputs always produce the same verdict, so a diff
 *     can only be caused by the rule change.
 *  3. No wall clock. Time comes from `record.observedAt`, never `Date.now()`. If a check
 *     read the real clock, replaying a decision tomorrow would judge it against tomorrow,
 *     and the diff would be noise.
 */

function num(params: Rule["params"], key: string, fallback: number): number {
  const v = params[key];
  return typeof v === "number" ? v : fallback;
}

function bool(params: Rule["params"], key: string, fallback: boolean): boolean {
  const v = params[key];
  return typeof v === "boolean" ? v : fallback;
}

function skipped(rule: Rule, reason: string, readFrom: string): CheckResult {
  return {
    ruleId: rule.id,
    label: rule.label,
    passed: true,
    skipped: true,
    reason,
    expected: "—",
    actual: "—",
    readFrom,
  };
}

type CheckFn = (po: PurchaseOrder, record: RecordSnapshot, rule: Rule) => CheckResult;

// ---------------------------------------------------------------------------
// 1. The PO exists on the record and was actually accepted
// ---------------------------------------------------------------------------

const poExists: CheckFn = (po, record, rule) => {
  const requireAccepted = bool(rule.params, "requireAccepted", true);
  const quote = record.quote;
  const base = { ruleId: rule.id, label: rule.label, readFrom: "record.quote" };

  if (!quote) {
    return {
      ...base,
      passed: false,
      reason: `No accepted quote exists for ${po.poNumber}. The agent declared a purchase order the system of record has never seen.`,
      expected: `a quote on record for ${po.poNumber}`,
      actual: "no such purchase order",
    };
  }

  if (requireAccepted && quote.status !== "accepted") {
    return {
      ...base,
      passed: false,
      reason: `Purchase order ${po.poNumber} is ${quote.status}, not accepted. Only an accepted quote can back a card.`,
      expected: "status accepted",
      actual: `status ${quote.status}`,
    };
  }

  return {
    ...base,
    passed: true,
    reason: `Purchase order ${po.poNumber} is on record and accepted.`,
    expected: "status accepted",
    actual: `status ${quote.status}`,
  };
};

// ---------------------------------------------------------------------------
// 2. Still open, and the quote it rests on has not expired
// ---------------------------------------------------------------------------

const poOpen: CheckFn = (po, record, rule) => {
  const quote = record.quote;
  const base = { ruleId: rule.id, label: rule.label, readFrom: "record.quote.fulfilled" };
  if (!quote) return skipped(rule, "No quote on record — see the PO exists check.", base.readFrom);

  if (quote.fulfilled) {
    return {
      ...base,
      passed: false,
      reason: `Purchase order ${po.poNumber} is already fulfilled. Paying it again would be a duplicate spend.`,
      expected: "an open, unfulfilled order line",
      actual: "already fulfilled",
    };
  }

  if (!bool(rule.params, "allowExpiredQuote", false)) {
    const graceMs = num(rule.params, "expiryGraceHours", 0) * 3_600_000;
    // Wall clock deliberately not used — see the file header.
    const observed = Date.parse(record.observedAt);
    const expiry = Date.parse(quote.quoteExpiry);
    if (Number.isFinite(observed) && Number.isFinite(expiry) && observed > expiry + graceMs) {
      return {
        ...base,
        readFrom: "record.quote.quoteExpiry",
        passed: false,
        reason: `The quote behind ${po.poNumber} expired on ${quote.quoteExpiry.slice(0, 10)}. The price is no longer one the vendor agreed to.`,
        expected: `a quote valid at ${record.observedAt.slice(0, 16).replace("T", " ")}`,
        actual: `expired ${quote.quoteExpiry.slice(0, 16).replace("T", " ")}`,
      };
    }
  }

  return {
    ...base,
    passed: true,
    reason: `Purchase order ${po.poNumber} is open and its quote is still valid.`,
    expected: "open and unexpired",
    actual: "open and unexpired",
  };
};

// ---------------------------------------------------------------------------
// 3. The amount matches the quote, within the configured tolerance
// ---------------------------------------------------------------------------

const amountMatches: CheckFn = (po, record, rule) => {
  const quote = record.quote;
  const base = { ruleId: rule.id, label: rule.label, readFrom: "record.quote.unitPrice × quantity" };
  if (!quote) return skipped(rule, "No quote on record — see the PO exists check.", base.readFrom);

  const toleranceBps = num(rule.params, "toleranceBps", 0);
  const quoted = quote.unitPrice * quote.quantity;
  const asked = poTotal(po);
  const allowed = Math.floor((quoted * toleranceBps) / 10_000);
  const delta = Math.abs(asked - quoted);

  if (delta > allowed) {
    const pct = quoted === 0 ? "∞" : ((delta / quoted) * 100).toFixed(2);
    return {
      ...base,
      passed: false,
      reason: `The card was requested for ${money(asked)} but the accepted quote is ${money(quoted)}, a difference of ${money(delta)} (${pct}%). Tolerance is ${(toleranceBps / 100).toFixed(2)}%.`,
      expected: `${money(quoted)} ± ${money(allowed)}`,
      actual: money(asked),
    };
  }

  return {
    ...base,
    passed: true,
    reason: `Requested ${money(asked)} against a quoted ${money(quoted)}, within the ${(toleranceBps / 100).toFixed(2)}% tolerance.`,
    expected: `${money(quoted)} ± ${money(allowed)}`,
    actual: money(asked),
  };
};

// ---------------------------------------------------------------------------
// 4. Right vendor AND right item
//
// The SKU half is the one no card network can express at any granularity. An issuer
// bounds amount, merchant, category and frequency — it does not know your order system
// exists, so "right vendor, right total, wrong item" passes every control there is.
// ---------------------------------------------------------------------------

const lineMatches: CheckFn = (po, record, rule) => {
  const quote = record.quote;
  const base = { ruleId: rule.id, label: rule.label, readFrom: "record.quote.vendor / .sku" };
  if (!quote) return skipped(rule, "No quote on record — see the PO exists check.", base.readFrom);

  const caseSensitive = bool(rule.params, "caseSensitive", false);
  const norm = (s: string) => (caseSensitive ? s.trim() : s.trim().toLowerCase());

  if (bool(rule.params, "checkVendor", true) && norm(po.vendor) !== norm(quote.vendor)) {
    return {
      ...base,
      readFrom: "record.quote.vendor",
      passed: false,
      reason: `The card would be issued to ${po.vendor}, but ${po.poNumber} was negotiated with ${quote.vendor}. Right price, wrong counterparty.`,
      expected: quote.vendor,
      actual: po.vendor,
    };
  }

  if (bool(rule.params, "checkSku", true) && norm(po.sku) !== norm(quote.sku)) {
    return {
      ...base,
      readFrom: "record.quote.sku",
      passed: false,
      reason: `The quote for ${po.poNumber} is for ${quote.sku}, but the agent is buying ${po.sku}. Right vendor, right total, wrong item — no card control can see this.`,
      expected: quote.sku,
      actual: po.sku,
    };
  }

  return {
    ...base,
    passed: true,
    reason: `Vendor ${po.vendor} and SKU ${po.sku} both match the accepted quote.`,
    expected: `${quote.vendor} / ${quote.sku}`,
    actual: `${po.vendor} / ${po.sku}`,
  };
};

// ---------------------------------------------------------------------------
// 5. Within what the cost centre has left
// ---------------------------------------------------------------------------

const withinBudget: CheckFn = (po, record, rule) => {
  const budget = record.budget;
  const base = { ruleId: rule.id, label: rule.label, readFrom: "record.budget" };

  if (!budget) {
    if (bool(rule.params, "blockOnMissingBudget", true)) {
      return {
        ...base,
        passed: false,
        reason: `No budget is on record for cost centre ${po.costCentre}, so there is nothing to spend against.`,
        expected: `a budget for ${po.costCentre}`,
        actual: "no budget on record",
      };
    }
    return skipped(rule, `No budget on record for ${po.costCentre}, rule configured not to block.`, base.readFrom);
  }

  const remaining = budget.limitCents - budget.spentCents;
  const asked = poTotal(po);

  if (asked > remaining) {
    return {
      ...base,
      passed: false,
      reason: `${po.costCentre} has ${money(remaining)} left this period and this purchase is ${money(asked)}. It would overspend by ${money(asked - remaining)}.`,
      expected: `at most ${money(remaining)} remaining`,
      actual: money(asked),
    };
  }

  return {
    ...base,
    passed: true,
    reason: `${money(asked)} against ${money(remaining)} remaining in ${po.costCentre}.`,
    expected: `at most ${money(remaining)} remaining`,
    actual: money(asked),
  };
};

// ---------------------------------------------------------------------------
// 6. Idempotency. The order line is the key.
//
// This is the check that carries the demo: run the same task twice and the second run is
// refused by the record the first run itself wrote. Nothing about that is scripted.
// ---------------------------------------------------------------------------

const noExistingCard: CheckFn = (po, record, rule) => {
  const card = record.existingCard;
  const base = { ruleId: rule.id, label: rule.label, readFrom: "record.existingCard" };

  if (card) {
    const countRevoked = bool(rule.params, "countRevoked", true);
    if (card.revokedAt && !countRevoked) {
      return {
        ...base,
        passed: true,
        reason: `A card was issued for ${po.poNumber} but has been revoked, and this rule version does not count revoked cards.`,
        expected: "no live card for this PO",
        actual: `card ${card.cardId} revoked ${card.revokedAt.slice(0, 10)}`,
      };
    }
    return {
      ...base,
      passed: false,
      reason: `Card ${card.cardId} was already issued for ${po.poNumber} at ${card.issuedAt.slice(11, 16)}. A retry returns that card, it does not create a second one.`,
      expected: "no card yet for this PO",
      actual: `card ${card.cardId} issued ${card.issuedAt.slice(0, 16).replace("T", " ")}`,
    };
  }

  return {
    ...base,
    passed: true,
    reason: `No card has been issued against ${po.poNumber} yet.`,
    expected: "no card yet for this PO",
    actual: "none",
  };
};

// ---------------------------------------------------------------------------
// 7. Delegated authority. Not a refusal — an escalation.
//
// "There is no human in the loop" is only alarming when it is unconditional. No company
// gives an employee unlimited spending authority either; it gives bounded autonomy with
// an escalation path above a threshold. An agent gets exactly the same deal.
// ---------------------------------------------------------------------------

const requiresApproval: CheckFn = (po, _record, rule) => {
  const threshold = num(rule.params, "thresholdCents", Number.MAX_SAFE_INTEGER);
  const role = String(rule.params.approverRole ?? "an approver");
  const asked = poTotal(po);
  const base = { ruleId: rule.id, label: rule.label, readFrom: "policy.thresholdCents" };

  if (asked > threshold) {
    return {
      ...base,
      passed: false,
      escalates: true,
      reason: `${money(asked)} is above the ${money(threshold)} delegated limit, so this is held for ${role} to release. Every other check passed — no card exists until a person signs off.`,
      expected: `at most ${money(threshold)} without sign-off`,
      actual: money(asked),
    };
  }

  return {
    ...base,
    passed: true,
    reason: `${money(asked)} is within the agent's ${money(threshold)} delegated authority.`,
    expected: `at most ${money(threshold)} without sign-off`,
    actual: money(asked),
  };
};


// ---------------------------------------------------------------------------
// 8. Not a large purchase chopped into small ones to duck the approval limit
// ---------------------------------------------------------------------------

/**
 * The counter to rule 7's obvious weakness.
 *
 * A $30,000 purchase gets held. Two $15,000 purchases do not — each is individually
 * within authority, and every other check passes on both. The only thing that sees it is
 * a rule that looks at the running total on the same vendor and cost centre rather than
 * at one line in isolation.
 *
 * It escalates rather than refuses. Buying twice from one supplier in a day is completely
 * ordinary; buying twice in a way that happens to stay just under the ceiling is worth a
 * person's attention, not an accusation.
 */
const noStructuring: CheckFn = (po, record, rule) => {
  const base = { ruleId: rule.id, label: rule.label, readFrom: "record.history.sameVendorCostCentreCents" };
  const h = record.history;
  if (!h) {
    return skipped(rule, "No spend history was captured with this decision.", base.readFrom);
  }

  const windowHours = num(rule.params, "windowHours", 24);
  const threshold = num(rule.params, "thresholdCents", 2_500_000);
  const asked = poTotal(po);
  const combined = asked + h.sameVendorCostCentreCents;

  // Only interesting when this line on its own would have sailed through.
  if (asked < threshold && combined >= threshold && h.sameVendorCostCentreCount > 0) {
    return {
      ...base,
      passed: false,
      escalates: true,
      reason: `On its own this is ${money(asked)}, under the ${money(threshold)} limit — but ${money(h.sameVendorCostCentreCents)} has already gone to ${po.vendor} on ${po.costCentre} in the last ${windowHours} hours, making ${money(combined)} together. Split purchases are how an approval limit gets sidestepped, so a person confirms this one.`,
      expected: `under ${money(threshold)} combined over ${windowHours}h`,
      actual: `${money(combined)} across ${h.sameVendorCostCentreCount + 1} purchases`,
    };
  }

  return {
    ...base,
    passed: true,
    reason:
      h.sameVendorCostCentreCount === 0
        ? `Nothing else has gone to ${po.vendor} on ${po.costCentre} in the last ${windowHours} hours.`
        : `${money(combined)} to ${po.vendor} on ${po.costCentre} over ${windowHours} hours, under the ${money(threshold)} limit.`,
    expected: `under ${money(threshold)} combined over ${windowHours}h`,
    actual: money(combined),
  };
};

// ---------------------------------------------------------------------------
// 9. Inside this particular agent's own signing limit
// ---------------------------------------------------------------------------

/**
 * One global ceiling treats every agent as equally trusted. A real delegation matrix does
 * not: the person ordering stationery and the person ordering capital equipment have very
 * different limits, and so should their agents.
 */
const agentAuthority: CheckFn = (po, record, rule) => {
  const base = { ruleId: rule.id, label: rule.label, readFrom: "record.agent" };
  const agent = record.agent;
  if (!agent) {
    return skipped(rule, "No agent was recorded on this decision.", base.readFrom);
  }

  const limit = num(rule.params, agent, num(rule.params, "defaultCents", 500_000));
  const asked = poTotal(po);

  if (asked > limit) {
    return {
      ...base,
      passed: false,
      escalates: true,
      reason: `${agent} is trusted up to ${money(limit)} unattended, and this is ${money(asked)}. Not refused — it needs whoever holds a bigger limit to release it.`,
      expected: `at most ${money(limit)} for ${agent}`,
      actual: money(asked),
    };
  }

  return {
    ...base,
    passed: true,
    reason: `${money(asked)} is inside ${agent}'s own ${money(limit)} limit.`,
    expected: `at most ${money(limit)} for ${agent}`,
    actual: money(asked),
  };
};

// ---------------------------------------------------------------------------
// 10. A vendor somebody has paid before
// ---------------------------------------------------------------------------

/**
 * Invoice fraud almost always arrives as a payee nobody has ever paid. A first payment to
 * a new supplier is still perfectly normal business, so this holds rather than refuses —
 * it is the pairing of "new payee" and "nobody looked" that loses the money.
 */
const knownVendor: CheckFn = (po, record, rule) => {
  const base = { ruleId: rule.id, label: rule.label, readFrom: "record.history.vendorEverPaid" };
  const h = record.history;
  if (!h) {
    return skipped(rule, "No vendor history was captured with this decision.", base.readFrom);
  }
  if (!bool(rule.params, "escalateOnFirstPayment", true)) {
    return skipped(rule, "First-payment escalation is switched off in this policy.", base.readFrom);
  }

  if (!h.vendorEverPaid) {
    return {
      ...base,
      passed: false,
      escalates: true,
      reason: `${po.vendor} has never been paid before. A first payment to a new supplier is normal, and it is also what invoice fraud looks like, so a person confirms it once.`,
      expected: "a supplier with payment history",
      actual: `first ever payment to ${po.vendor}`,
    };
  }

  return {
    ...base,
    passed: true,
    reason: `${po.vendor} has been paid before.`,
    expected: "a supplier with payment history",
    actual: "known supplier",
  };
};

// ---------------------------------------------------------------------------
// 11. Not spending faster than this agent should be able to
// ---------------------------------------------------------------------------

/**
 * The failure every other check is blind to. An agent stuck in a loop, or one that has
 * been taken over, makes purchases that are each individually perfect. Nothing is wrong
 * with any single one of them. Only the rate is wrong.
 *
 * This refuses rather than escalates: a runaway agent should stop now, and a person can
 * always raise the limit afterwards.
 */
const velocity: CheckFn = (po, record, rule) => {
  const base = { ruleId: rule.id, label: rule.label, readFrom: "record.history.agentCount" };
  const h = record.history;
  if (!h) {
    return skipped(rule, "No spend history was captured with this decision.", base.readFrom);
  }

  const windowHours = num(rule.params, "windowHours", 24);
  const maxCount = num(rule.params, "maxCount", 12);
  const maxTotal = num(rule.params, "maxTotalCents", 10_000_000);
  const agent = record.agent ?? "this agent";
  const nextCount = h.agentCount + 1;
  const nextTotal = h.agentTotalCents + poTotal(po);

  if (nextCount > maxCount) {
    return {
      ...base,
      passed: false,
      reason: `${agent} has already made ${h.agentCount} purchases in the last ${windowHours} hours, and the ceiling is ${maxCount}. Each one may be fine on its own; the rate is not.`,
      expected: `at most ${maxCount} purchases per ${windowHours}h`,
      actual: `${nextCount} purchases`,
    };
  }

  if (nextTotal > maxTotal) {
    return {
      ...base,
      passed: false,
      reason: `${agent} would reach ${money(nextTotal)} in ${windowHours} hours, over the ${money(maxTotal)} ceiling for that period.`,
      expected: `at most ${money(maxTotal)} per ${windowHours}h`,
      actual: money(nextTotal),
    };
  }

  return {
    ...base,
    passed: true,
    reason: `${nextCount} of ${maxCount} purchases and ${money(nextTotal)} of ${money(maxTotal)} used in the last ${windowHours} hours.`,
    expected: `at most ${maxCount} purchases and ${money(maxTotal)} per ${windowHours}h`,
    actual: `${nextCount} purchases, ${money(nextTotal)}`,
  };
};

const CHECKS: Record<RuleId, CheckFn> = {
  "po-exists": poExists,
  "po-open": poOpen,
  "amount-matches": amountMatches,
  "line-matches": lineMatches,
  "within-budget": withinBudget,
  "no-existing-card": noExistingCard,
  "no-structuring": noStructuring,
  "agent-authority": agentAuthority,
  "known-vendor": knownVendor,
  velocity,
  "requires-approval": requiresApproval,
};

/**
 * The single entry point. Pure: same PO, same snapshot, same rule version, same answer,
 * forever. That is the property replay is built on.
 */
export function verify(
  po: PurchaseOrder,
  record: RecordSnapshot,
  ruleSet: RuleSet
): VerifyResult {
  const checks: CheckResult[] = [];

  for (const rule of ruleSet.rules) {
    const fn = CHECKS[rule.id];
    if (!fn) continue;

    if (!rule.enabled) {
      checks.push(skipped(rule, `Rule is disabled in policy v${ruleSet.version}.`, "—"));
      continue;
    }

    checks.push(fn(po, record, rule));
  }

  // A purchase that is *wrong* and a purchase that is merely *large* need different
  // answers. Collapsing them would either block legitimate spending or wave through the
  // very thing you most wanted a person to see.
  const blocked = checks.filter((c) => !c.passed && !c.escalates);
  const escalations = checks.filter((c) => !c.passed && c.escalates);

  return {
    ok: blocked.length === 0 && escalations.length === 0,
    checks,
    failures: blocked,
    escalations,
  };
}
