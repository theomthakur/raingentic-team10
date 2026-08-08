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
 * The six checks.
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

const CHECKS: Record<RuleId, CheckFn> = {
  "po-exists": poExists,
  "po-open": poOpen,
  "amount-matches": amountMatches,
  "line-matches": lineMatches,
  "within-budget": withinBudget,
  "no-existing-card": noExistingCard,
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

  const failures = checks.filter((c) => !c.passed);
  return { ok: failures.length === 0, checks, failures };
}
