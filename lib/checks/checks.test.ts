/**
 * Tests for the decision layer. No framework — `tsx lib/checks/checks.test.ts`.
 *
 * The point of these is not coverage, it is the two properties the pitch rests on:
 * determinism, and that every threshold comes from rule data rather than from code.
 */
import assert from "node:assert/strict";
import type { PurchaseOrder, RecordSnapshot, Rule, RuleSet } from "@/lib/types";
import { verify } from "@/lib/checks";
import { defaultRuleSet, nextRuleSet } from "@/lib/rules/defaults";
import { hashRules } from "@/lib/rules/hash";
import { replay } from "@/lib/replay";
import seeded from "@/lib/seed/decisions.json";
import type { Decision } from "@/lib/types";

let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push(`${name}\n    ${(err as Error).message.split("\n")[0]}`);
  }
}

// --- fixtures --------------------------------------------------------------

const OBSERVED = "2026-08-08T12:00:00.000Z";

function po(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    poNumber: "PO-9001",
    vendor: "Nordhaven Supply Co",
    sku: "NH-BRK-2200",
    unitPrice: 10_000,
    quantity: 10,
    quoteExpiry: "2026-09-01T00:00:00.000Z",
    costCentre: "CC-OPS",
    ...overrides,
  };
}

function record(overrides: Partial<RecordSnapshot> = {}): RecordSnapshot {
  return {
    quote: {
      poNumber: "PO-9001",
      status: "accepted",
      fulfilled: false,
      vendor: "Nordhaven Supply Co",
      sku: "NH-BRK-2200",
      unitPrice: 10_000,
      quantity: 10,
      quoteExpiry: "2026-09-01T00:00:00.000Z",
    },
    budget: { costCentre: "CC-OPS", limitCents: 1_000_000, spentCents: 0 },
    existingCard: null,
    observedAt: OBSERVED,
    ...overrides,
  };
}

const RULES = defaultRuleSet();
const failed = (r: ReturnType<typeof verify>) => r.failures.map((f) => f.ruleId);

// --- the happy path --------------------------------------------------------

test("a PO that matches the record in every way is approved", () => {
  const r = verify(po(), record(), RULES);
  assert.equal(r.ok, true, `expected approval, got failures: ${failed(r)}`);
  assert.equal(r.checks.length, 6);
});

// --- rule 1 ----------------------------------------------------------------

test("rule 1 refuses a PO the record has never seen", () => {
  const r = verify(po(), record({ quote: null }), RULES);
  assert.equal(r.ok, false);
  assert.ok(failed(r).includes("po-exists"));
});

test("quote-dependent checks are skipped, not failed, when there is no quote", () => {
  const r = verify(po(), record({ quote: null }), RULES);
  // One clear reason beats four noisy ones in the provenance panel.
  assert.deepEqual(failed(r), ["po-exists"]);
  assert.equal(r.checks.filter((c) => c.skipped).length, 3);
});

test("rule 1 refuses a quote that was never accepted", () => {
  const r = verify(po(), record({ quote: { ...record().quote!, status: "draft" } }), RULES);
  assert.ok(failed(r).includes("po-exists"));
});

// --- rule 2 ----------------------------------------------------------------

test("rule 2 refuses an already-fulfilled order line", () => {
  const r = verify(po(), record({ quote: { ...record().quote!, fulfilled: true } }), RULES);
  assert.ok(failed(r).includes("po-open"));
});

test("rule 2 refuses a quote that had expired when the record was read", () => {
  const r = verify(
    po(),
    record({
      quote: { ...record().quote!, quoteExpiry: "2026-08-01T00:00:00.000Z" },
    }),
    RULES
  );
  assert.ok(failed(r).includes("po-open"));
});

test("expiry is judged against the snapshot, never the wall clock", () => {
  // Same inputs, an observedAt before the expiry: must pass regardless of today's date.
  const r = verify(
    po(),
    record({
      quote: { ...record().quote!, quoteExpiry: "2026-08-01T00:00:00.000Z" },
      observedAt: "2026-07-30T00:00:00.000Z",
    }),
    RULES
  );
  assert.equal(r.ok, true, `expected approval, got: ${failed(r)}`);
});

// --- rule 3, and that the threshold really is data -------------------------

test("rule 3 allows drift inside the configured tolerance", () => {
  // 1% over on a 2% tolerance.
  const r = verify(po({ unitPrice: 10_100 }), record(), RULES);
  assert.equal(r.ok, true, `expected approval, got: ${failed(r)}`);
});

test("rule 3 refuses drift outside the configured tolerance", () => {
  const r = verify(po({ unitPrice: 10_500 }), record(), RULES);
  assert.ok(failed(r).includes("amount-matches"));
});

test("tightening the tolerance is a data change, not a code change", () => {
  const tightened = RULES.rules.map((rule) =>
    rule.id === "amount-matches" ? { ...rule, params: { toleranceBps: 0 } } : rule
  );
  const v2: RuleSet = nextRuleSet(RULES, tightened, "Zero tolerance");
  const drifted = po({ unitPrice: 10_100 });

  assert.equal(verify(drifted, record(), RULES).ok, true);
  assert.equal(verify(drifted, record(), v2).ok, false);
});

// --- rule 4 ----------------------------------------------------------------

test("rule 4 refuses the right price at the wrong vendor", () => {
  const r = verify(po({ vendor: "Halloway Trading" }), record(), RULES);
  assert.ok(failed(r).includes("line-matches"));
});

test("rule 4 refuses the right vendor and right total but the wrong item", () => {
  const r = verify(po({ sku: "NH-BRK-2400" }), record(), RULES);
  assert.ok(failed(r).includes("line-matches"));
  // The SKU case is the one no card control can express at any granularity.
  assert.equal(verify(po({ sku: "NH-BRK-2400" }), record(), RULES).failures[0].expected, "NH-BRK-2200");
});

test("vendor comparison is case- and whitespace-insensitive by default", () => {
  const r = verify(po({ vendor: "  nordhaven supply co " }), record(), RULES);
  assert.equal(r.ok, true, `expected approval, got: ${failed(r)}`);
});

// --- rule 5 ----------------------------------------------------------------

test("rule 5 refuses a purchase that overruns the remaining budget", () => {
  const r = verify(
    po(),
    record({ budget: { costCentre: "CC-OPS", limitCents: 1_000_000, spentCents: 960_000 } }),
    RULES
  );
  assert.ok(failed(r).includes("within-budget"));
});

test("rule 5 allows a purchase that exactly consumes the remaining budget", () => {
  const r = verify(
    po(),
    record({ budget: { costCentre: "CC-OPS", limitCents: 1_000_000, spentCents: 900_000 } }),
    RULES
  );
  assert.equal(r.ok, true, `expected approval, got: ${failed(r)}`);
});

// --- rule 6, the one that carries the demo ---------------------------------

test("rule 6 refuses a second card for an order line that already has one", () => {
  const r = verify(
    po(),
    record({
      existingCard: { cardId: "card_abc", poNumber: "PO-9001", issuedAt: "2026-08-08T11:00:00.000Z" },
    }),
    RULES
  );
  assert.equal(r.ok, false);
  assert.ok(failed(r).includes("no-existing-card"));
});

test("a revoked card still blocks re-issuance while countRevoked is on", () => {
  const r = verify(
    po(),
    record({
      existingCard: {
        cardId: "card_abc",
        poNumber: "PO-9001",
        issuedAt: "2026-08-08T11:00:00.000Z",
        revokedAt: "2026-08-08T11:30:00.000Z",
      },
    }),
    RULES
  );
  assert.ok(failed(r).includes("no-existing-card"));
});

// --- disabled rules --------------------------------------------------------

test("a disabled rule is reported as skipped and blocks nothing", () => {
  const relaxed = RULES.rules.map((rule) =>
    rule.id === "line-matches" ? { ...rule, enabled: false } : rule
  );
  const v2 = nextRuleSet(RULES, relaxed, "Vendor check off");
  const r = verify(po({ vendor: "Halloway Trading" }), record(), v2);
  assert.equal(r.ok, true);
  assert.equal(r.checks.find((c) => c.ruleId === "line-matches")?.skipped, true);
});

// --- determinism, which is what makes replay mean anything -----------------

test("verify is deterministic across repeated runs", () => {
  const p = po({ unitPrice: 10_100 });
  const rec = record();
  const first = JSON.stringify(verify(p, rec, RULES));
  for (let i = 0; i < 50; i++) {
    assert.equal(JSON.stringify(verify(p, rec, RULES)), first);
  }
});

test("every check carries the four provenance fields", () => {
  for (const c of verify(po({ vendor: "Halloway Trading" }), record(), RULES).checks) {
    assert.ok(c.label.length > 0, `${c.ruleId} has no label`);
    assert.ok(c.reason.length > 0, `${c.ruleId} has no reason`);
    assert.ok(c.expected.length > 0, `${c.ruleId} has no expected`);
    assert.ok(c.actual.length > 0, `${c.ruleId} has no actual`);
    assert.ok(c.readFrom.length > 0, `${c.ruleId} has no readFrom`);
  }
});

test("no refusal reason is a bare 'validation failed'", () => {
  const r = verify(po({ vendor: "Halloway Trading", unitPrice: 99_999 }), record(), RULES);
  for (const f of r.failures) {
    assert.ok(f.reason.length > 30, `${f.ruleId} reason is too terse to act on`);
    assert.ok(!/validation failed/i.test(f.reason));
  }
});

// --- rule hashing, which is what gets anchored -----------------------------

test("the rule hash is stable regardless of rule order", () => {
  const shuffled = [...RULES.rules].reverse();
  assert.equal(hashRules(shuffled), hashRules(RULES.rules));
});

test("changing a single parameter changes the hash", () => {
  const edited: Rule[] = RULES.rules.map((rule) =>
    rule.id === "amount-matches" ? { ...rule, params: { toleranceBps: 0 } } : rule
  );
  assert.notEqual(hashRules(edited), hashRules(RULES.rules));
});

test("a new version never mutates the one it came from", () => {
  const before = JSON.stringify(RULES);
  nextRuleSet(RULES, RULES.rules.map((r) => ({ ...r, enabled: false })), "off");
  assert.equal(JSON.stringify(RULES), before);
});

// --- replay over the committed history -------------------------------------

const history = seeded as unknown as Decision[];

test("the seeded history is large enough for a replay diff to mean something", () => {
  assert.ok(history.length >= 40, `only ${history.length} seeded decisions`);
});

test("replaying history against its own rule version changes nothing", () => {
  const r = replay(history, RULES);
  assert.equal(r.approvedNowRefused.length, 0);
  assert.equal(r.refusedNowApproved.length, 0);
  assert.equal(r.unchanged, history.length);
});

test("tightening the amount tolerance flips approvals to refusals", () => {
  const tightened = RULES.rules.map((rule) =>
    rule.id === "amount-matches" ? { ...rule, params: { toleranceBps: 0 } } : rule
  );
  const r = replay(history, nextRuleSet(RULES, tightened, "Zero tolerance"));
  assert.ok(r.approvedNowRefused.length >= 5, `only ${r.approvedNowRefused.length} flipped`);
  assert.equal(r.refusedNowApproved.length, 0);
  for (const change of r.approvedNowRefused) {
    assert.ok(change.nowFailing.some((c) => c.ruleId === "amount-matches"));
  }
});

test("disabling the vendor and SKU rule flips refusals to approvals", () => {
  const relaxed = RULES.rules.map((rule) =>
    rule.id === "line-matches" ? { ...rule, enabled: false } : rule
  );
  const r = replay(history, nextRuleSet(RULES, relaxed, "Line check off"));
  assert.ok(r.refusedNowApproved.length >= 4, `only ${r.refusedNowApproved.length} flipped`);
  assert.equal(r.approvedNowRefused.length, 0);
});

test("every decision in the log accounts for itself in a replay", () => {
  const tightened = RULES.rules.map((rule) =>
    rule.id === "amount-matches" ? { ...rule, params: { toleranceBps: 0 } } : rule
  );
  const r = replay(history, nextRuleSet(RULES, tightened, "Zero tolerance"));
  assert.equal(
    r.unchanged + r.approvedNowRefused.length + r.refusedNowApproved.length,
    r.total
  );
});

// --- report ----------------------------------------------------------------

if (failures.length) {
  console.error(`\n✗ ${failures.length} failing, ${passed} passing\n`);
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}
console.log(`✓ ${passed} passing`);
