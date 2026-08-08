/**
 * Tests for the decision layer. No framework — `tsx lib/checks/checks.test.ts`.
 *
 * The point of these is not coverage, it is the two properties the pitch rests on:
 * determinism, and that every threshold comes from rule data rather than from code.
 */
import assert from "node:assert/strict";
import type {
  PurchaseOrder,
  RecordSnapshot,
  Rule,
  RuleId,
  RuleSet,
  SpendHistory,
} from "@/lib/types";
import { verify } from "@/lib/checks";
import {
  DEFAULT_RULES,
  activateRuleSet,
  defaultRuleSet,
  nextRuleSet,
} from "@/lib/rules/defaults";
import { RULE_BASIS, basisFor } from "@/lib/rules/basis";
import { proposePurchase } from "@/lib/agent";
import { hashRules } from "@/lib/rules/hash";
import { replay } from "@/lib/replay";
import { diffRules } from "@/lib/rules/diff";
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
    // The agent with the largest own-limit, so the older tests keep isolating the rule
    // they were written for rather than also tripping per-agent authority.
    agent: "procurement-02",
    history: spend(),
    ...overrides,
  };
}

/** A quiet history: nothing recent, supplier already known. The happy path. */
function spend(overrides: Partial<SpendHistory> = {}): SpendHistory {
  return {
    windowHours: 24,
    agentCount: 0,
    agentTotalCents: 0,
    sameVendorCostCentreCents: 0,
    sameVendorCostCentreCount: 0,
    vendorEverPaid: true,
    ...overrides,
  };
}

const RULES = defaultRuleSet();
const failed = (r: ReturnType<typeof verify>) => r.failures.map((f) => f.ruleId);

// --- the happy path --------------------------------------------------------

test("a PO that matches the record in every way is approved", () => {
  const r = verify(po(), record(), RULES);
  assert.equal(r.ok, true, `expected approval, got failures: ${failed(r)}`);
  assert.equal(r.checks.length, 11);
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

// --- dual control on policy changes ----------------------------------------

test("a new version starts pending, not active", () => {
  const v2 = nextRuleSet(RULES, RULES.rules, "tweak", "princy");
  assert.equal(v2.status, "pending");
  assert.equal(v2.proposedBy, "princy");
  assert.equal(v2.approvedBy, undefined);
});

test("the author cannot approve their own policy change", () => {
  const v2 = nextRuleSet(RULES, RULES.rules, "tweak", "princy");
  assert.throws(() => activateRuleSet(v2, "princy"), /cannot also approve/);
  // Case and padding must not be a way around it.
  assert.throws(() => activateRuleSet(v2, "  PRINCY "), /cannot also approve/);
});

test("a second person can activate it, and is recorded", () => {
  const v2 = nextRuleSet(RULES, RULES.rules, "tweak", "princy");
  const active = activateRuleSet(v2, "om");
  assert.equal(active.status, "active");
  assert.equal(active.approvedBy, "om");
  assert.ok(active.approvedAt);
  // Activation must not quietly alter the policy it approves.
  assert.equal(active.hash, v2.hash);
  assert.deepEqual(active.rules, v2.rules);
});

test("an already-active version cannot be activated again", () => {
  const v2 = activateRuleSet(nextRuleSet(RULES, RULES.rules, "tweak", "princy"), "om");
  assert.throws(() => activateRuleSet(v2, "someone-else"), /already active/);
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
    const flip = change.nowFailing.find((f) => f.now.ruleId === "amount-matches");
    assert.ok(flip, "amount-matches should be the rule that flipped");
    // Both sides of the comparison must be present, or the UI cannot explain the flip.
    assert.equal(flip.previously?.passed, true, "it should have passed under v1");
    assert.equal(flip.now.passed, false);
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

test("the seeded log leaves nothing waiting on a person", () => {
  // The console must not greet anyone with a queue of purchases needing a signature —
  // this is autonomous spending, and history should read as a backlog that was worked.
  const released = new Set(history.map((d) => d.releases).filter(Boolean));
  const waiting = history.filter((d) => d.outcome === "held" && !released.has(d.id));
  assert.equal(waiting.length, 0, `${waiting.length} seeded purchases still awaiting release`);
});

test("a released purchase is never re-held on replay", () => {
  // The delegated limit was answered by a person. Replaying must not re-litigate that,
  // or every historical release would flip to "held" on any policy change at all.
  const releases = history.filter((d) => d.approval);
  assert.ok(releases.length > 0, "no released decisions in the seeded history");

  for (const rules of [
    RULES.rules.map((r) => (r.id === "amount-matches" ? { ...r, params: { toleranceBps: 0 } } : r)),
    RULES.rules.map((r) => (r.id === "line-matches" ? { ...r, enabled: false } : r)),
  ]) {
    const r = replay(history, nextRuleSet(RULES, rules, "probe"));
    const reheld = [...r.approvedNowRefused, ...r.refusedNowApproved].filter(
      (c) => c.after === "held" && history.find((d) => d.id === c.decisionId)?.approval
    );
    assert.equal(reheld.length, 0, `${reheld.length} released purchases were re-held`);
  }
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

// --- rule 7, delegated authority: held is not refused -------------------------

test("a purchase under the delegated limit needs no human", () => {
  const r = verify(po(), record(), RULES);
  assert.equal(r.ok, true, `expected approval, got: ${failed(r)}`);
  assert.equal(r.escalations.length, 0);
});

/**
 * A rule set with one rule switched off, for isolating another.
 *
 * Needed because every per-agent limit is now at or below the company-wide ceiling — that
 * invariant is enforced by its own test, since a per-agent limit above the ceiling can never
 * bind. The consequence is that anything over the company ceiling is also over every
 * agent's own limit, so rules 7 and 9 escalate together and neither can be isolated by
 * choosing a generous agent. Switching the other off is honest about that.
 */
function without(id: RuleId): RuleSet {
  return { ...RULES, rules: RULES.rules.filter((r) => r.id !== id) };
}

test("a purchase above the delegated limit is escalated, not refused", () => {
  // $30,000 against a $25,000 limit, with the quote matching so nothing else can trip.
  const big = po({ unitPrice: 300_000, quantity: 10 });
  const rec = record({
    quote: { ...record().quote!, unitPrice: 300_000, quantity: 10 },
    budget: { costCentre: "CC-OPS", limitCents: 100_000_000, spentCents: 0 },
  });
  // Rule 9 out of the way, so this is about the company ceiling alone.
  const r = verify(big, rec, without("agent-authority"));

  assert.equal(r.ok, false, "it must not sail through");
  // The distinction the whole feature rests on.
  assert.equal(r.failures.length, 0, "nothing is actually wrong with it");
  assert.equal(r.escalations.length, 1, "it is waiting for a person");
  assert.equal(r.escalations[0].ruleId, "requires-approval");
  assert.equal(r.escalations[0].escalates, true);
});

test("something genuinely wrong AND large is refused, not merely held", () => {
  const big = po({ unitPrice: 300_000, quantity: 10, vendor: "Halloway Trading" });
  const rec = record({
    quote: { ...record().quote!, unitPrice: 300_000, quantity: 10 },
    budget: { costCentre: "CC-OPS", limitCents: 100_000_000, spentCents: 0 },
  });
  const r = verify(big, rec, RULES);
  // A person should never be asked to rubber-stamp a purchase that fails a hard rule.
  assert.ok(r.failures.length > 0, "the vendor mismatch is a hard failure");
  assert.ok(r.failures.some((f) => f.ruleId === "line-matches"));
});

test("the delegated limit is data, not a constant", () => {
  const raised = RULES.rules.map((rule) =>
    rule.id === "requires-approval"
      ? { ...rule, params: { ...rule.params, thresholdCents: 100_000_000 } }
      : rule
  );
  const v2 = nextRuleSet(RULES, raised, "Raise the limit");
  const big = po({ unitPrice: 300_000, quantity: 10 });
  const rec = record({
    quote: { ...record().quote!, unitPrice: 300_000, quantity: 10 },
    budget: { costCentre: "CC-OPS", limitCents: 100_000_000, spentCents: 0 },
  });

  // Rule 9 removed from both sides, so the only variable is rule 7's threshold.
  const base = without("agent-authority");
  const raisedOnly = { ...v2, rules: v2.rules.filter((r) => r.id !== "agent-authority") };

  assert.equal(verify(big, rec, base).escalations.length, 1);
  assert.equal(verify(big, rec, raisedOnly).escalations.length, 0);
});

test("every rule cites the real-world control it implements", () => {
  for (const rule of RULES.rules) {
    assert.ok(rule.basis && rule.basis.length > 20, `${rule.id} has no stated basis`);
  }
});

// --- the rule diff, which is what explains a replay --------------------------

test("the rule diff names the exact parameter that moved", () => {
  const tightened = RULES.rules.map((rule) =>
    rule.id === "amount-matches" ? { ...rule, params: { toleranceBps: 0 } } : rule
  );
  const changes = diffRules(RULES.rules, tightened);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].ruleId, "amount-matches");
  assert.equal(changes[0].field, "toleranceBps");
  assert.equal(changes[0].before, "200");
  assert.equal(changes[0].after, "0");
});

test("the rule diff reports a rule being switched off", () => {
  const relaxed = RULES.rules.map((rule) =>
    rule.id === "line-matches" ? { ...rule, enabled: false } : rule
  );
  const changes = diffRules(RULES.rules, relaxed);
  assert.deepEqual(
    changes.map((c) => [c.field, c.before, c.after]),
    [["enabled", "on", "off"]]
  );
});

test("an unchanged policy produces an empty diff", () => {
  assert.deepEqual(diffRules(RULES.rules, RULES.rules), []);
});

// --- concurrency: idempotency as a property, not a claim ---------------------

const asyncTests: [string, () => Promise<void>][] = [];
function asyncTest(name: string, fn: () => Promise<void>) {
  asyncTests.push([name, fn]);
}

/**
 * New-payee verification must not defeat itself.
 *
 * The bug: spend history counted approved *and* held rows as evidence the vendor had been
 * paid. So the first purchase from a new supplier was held for review, that hold alone made
 * the vendor "known", and a simple retry passed the control with nobody approving anything.
 * A retry is not a signature.
 */
asyncTest("a held purchase does not make its vendor a known payee", async () => {
  const { createMemoryStore } = await import("@/lib/store/memory");
  const store = createMemoryStore();
  await store.reset();

  const order = po({ vendor: "Brand New Vendor Ltd" });
  const mk = (id: string, outcome: "held" | "refused" | "approved"): Decision => ({
    id,
    createdAt: new Date().toISOString(),
    po: order,
    record: record(),
    ruleVersion: 1,
    checks: [],
    outcome,
    card: null,
    agent: "procurement-01",
  });

  const ask = () =>
    store.getSpendHistory({
      agent: "procurement-01",
      vendor: order.vendor,
      costCentre: order.costCentre,
      windowHours: 24,
    });

  assert.equal((await ask()).vendorEverPaid, false, "nothing paid yet");

  await store.appendDecision(mk("dec_held", "held"));
  assert.equal(
    (await ask()).vendorEverPaid,
    false,
    "a hold paid nobody — counting it lets a retry bypass the control"
  );

  await store.appendDecision(mk("dec_refused", "refused"));
  assert.equal((await ask()).vendorEverPaid, false, "a refusal paid nobody either");

  await store.appendDecision(mk("dec_approved", "approved"));
  assert.equal((await ask()).vendorEverPaid, true, "an approved purchase did pay them");
});

asyncTest("a purchase is not counted against itself when it is released", async () => {
  // Held rows count as exposure, correctly — but that means the held row for this very
  // order line is already in the totals when a person releases it, so the release used to
  // add the amount a second time. A $43,500 purchase looked like $87,000 and was refused on
  // velocity, which reads as the system contradicting its own approval.
  const { createMemoryStore } = await import("@/lib/store/memory");
  const { snapshot } = await import("@/lib/store/types");
  const store = createMemoryStore();
  await store.reset();

  const order = po({ unitPrice: 4_350_000, quantity: 1, vendor: "Bellweather Industrial" });

  const before = await snapshot(store, order, "procurement-02");
  const baseline = {
    count: before.history!.agentCount,
    total: before.history!.agentTotalCents,
    line: before.history!.sameVendorCostCentreCents,
  };

  await store.appendDecision({
    id: "dec_the_hold",
    createdAt: new Date().toISOString(),
    po: order,
    record: record(),
    ruleVersion: 1,
    checks: [],
    outcome: "held",
    card: null,
    agent: "procurement-02",
  });

  // Compared against the same snapshot taken before the hold existed, because reset()
  // loads the committed history and absolute totals are not the point — the delta is.
  const after = await snapshot(store, order, "procurement-02");
  assert.deepEqual(
    {
      count: after.history!.agentCount,
      total: after.history!.agentTotalCents,
      line: after.history!.sameVendorCostCentreCents,
    },
    baseline,
    "the held row for this same order line must not inflate its own exposure"
  );
});

asyncTest("a different order line to the same vendor does still count", async () => {
  // The exclusion is scoped to the order line, not the vendor — otherwise structuring
  // detection would be trivially defeated by using a fresh PO number each time.
  const { createMemoryStore } = await import("@/lib/store/memory");
  const { snapshot } = await import("@/lib/store/types");
  const store = createMemoryStore();
  await store.reset();

  const first = po({ poNumber: "PO-AAA", unitPrice: 1_000_000, quantity: 1, vendor: "Solo Vendor Co" });
  const second = po({ poNumber: "PO-BBB", unitPrice: 1_000_000, quantity: 1, vendor: "Solo Vendor Co" });

  const before = await snapshot(store, second, "procurement-02");

  await store.appendDecision({
    id: "dec_first",
    createdAt: new Date().toISOString(),
    po: first,
    record: record(),
    ruleVersion: 1,
    checks: [],
    outcome: "approved",
    card: null,
    agent: "procurement-02",
  });

  const after = await snapshot(store, second, "procurement-02");
  assert.equal(
    after.history!.sameVendorCostCentreCents - before.history!.sameVendorCostCentreCents,
    1_000_000,
    "a separate order line to the same vendor must still count"
  );
  assert.equal(after.history!.agentCount - before.history!.agentCount, 1);
});

asyncTest("held rows still count toward exposure, so the hold queue cannot be used to structure", async () => {
  // The other half of the same filter: a held purchase is pending a signature rather than
  // abandoned, so it must still count against the rate and structuring windows.
  const { createMemoryStore } = await import("@/lib/store/memory");
  const store = createMemoryStore();
  await store.reset();

  const order = po({ unitPrice: 100_000, quantity: 1, vendor: "Exposure Test Co" });
  await store.appendDecision({
    id: "dec_pending",
    createdAt: new Date().toISOString(),
    po: order,
    record: record(),
    ruleVersion: 1,
    checks: [],
    outcome: "held",
    card: null,
    agent: "procurement-01",
  });

  const h = await store.getSpendHistory({
    agent: "procurement-01",
    vendor: order.vendor,
    costCentre: order.costCentre,
    windowHours: 24,
  });
  assert.equal(h.agentCount, 1, "a held purchase is still exposure");
  assert.equal(h.sameVendorCostCentreCents, 100_000);
  assert.equal(h.vendorEverPaid, false, "but still not a payment");
});

asyncTest("every vendor the negotiation can pick has settled payment history", async () => {
  // Guards the demo path: without this, the first run from a clean reset is held on a new
  // payee, so the run-it-twice moment needs three presses and opens on a rule that has to
  // be explained away. Adding a seller to a negotiation without regenerating the seed
  // fails here rather than in front of a judge.
  const { SELLERS_BY_TASK } = await import("@/lib/sellers");
  const paid = new Set(
    (seeded as unknown as Decision[])
      .filter((d) => d.outcome === "approved")
      .map((d) => d.po.vendor)
  );
  const missing = Object.values(SELLERS_BY_TASK)
    .flat()
    .map((s) => s.vendor)
    .filter((v) => !paid.has(v));
  assert.deepEqual(missing, [], `these sellers have no settled history: ${missing.join(", ")}`);
});

asyncTest("two concurrent claims on the same order line: exactly one wins", async () => {
  const { createMemoryStore } = await import("@/lib/store/memory");
  const store = createMemoryStore();
  await store.reset();

  const results = await Promise.all(
    Array.from({ length: 8 }, () => store.claimOrderLine("PO-RACE"))
  );
  assert.equal(
    results.filter(Boolean).length,
    1,
    "exactly one caller may hold an order line"
  );
});

asyncTest("different order lines do not block each other", async () => {
  const { createMemoryStore } = await import("@/lib/store/memory");
  const store = createMemoryStore();
  await store.reset();

  const results = await Promise.all([
    store.claimOrderLine("PO-A"),
    store.claimOrderLine("PO-B"),
    store.claimOrderLine("PO-C"),
  ]);
  assert.deepEqual(results, [true, true, true]);
});

asyncTest("a released line can be claimed again, so a failure is not a permanent lock", async () => {
  const { createMemoryStore } = await import("@/lib/store/memory");
  const store = createMemoryStore();
  await store.reset();

  assert.equal(await store.claimOrderLine("PO-RETRY"), true);
  assert.equal(await store.claimOrderLine("PO-RETRY"), false);
  await store.releaseOrderLine("PO-RETRY");
  assert.equal(await store.claimOrderLine("PO-RETRY"), true);
});

// --- report ----------------------------------------------------------------

/**
 * The basis strings are load-bearing for the argument, not decoration: the provenance panel
 * shows the control a rule descends from on the row that just refused a purchase. A rule
 * whose id is missing from RULE_BASIS renders nothing and fails silently — the row simply
 * is not there, and nobody notices until a judge asks where the rule came from.
 *
 * They also live in their own module so a client component can read them without dragging
 * node:crypto into the browser bundle, which means the two can drift apart. These tests
 * are what stops that.
 */
/**
 * The boundary guard, so a malformed order never reaches the checks at all.
 *
 * Defence in depth on purpose: the checks fail closed regardless, but an order that cannot
 * be priced should be rejected before a negotiation runs on it and writes a nonsense quote
 * to the record.
 */
for (const badQuantity of [0, -5, 1.5, NaN, Infinity]) {
  test(`proposePurchase refuses quantity ${badQuantity}`, () => {
    assert.throws(
      () => proposePurchase({ taskKey: "office-supplies", quantity: badQuantity, targetPriceCents: 4_000 }),
      /positive whole number/,
      `quantity ${badQuantity} should have been rejected`
    );
  });
}

test("proposePurchase accepts a sane quantity and prices it", () => {
  const { po: proposed } = proposePurchase({
    taskKey: "office-supplies",
    quantity: 10,
    targetPriceCents: 4_000,
  });
  assert.ok(Number.isInteger(proposed.unitPrice), "unit price must be whole cents");
  assert.ok(proposed.unitPrice > 0);
  assert.equal(proposed.quantity, 10);
  assert.ok(Number.isSafeInteger(proposed.unitPrice * proposed.quantity));
});

/**
 * Arithmetic in the decision path fails closed.
 *
 * The bug these lock down: `quantity: 0` on the negotiated path produced a PO with a null
 * unit price, and the NaN total silently PASSED six of the eleven checks, because every
 * comparison against NaN is false. It then charged a cost centre NaN, which disabled that
 * budget's check permanently — from then on `asked > NaN` was false too.
 *
 * A figure a check cannot reason about must be a refusal, never a pass.
 */
const AMOUNT_DEPENDENT: RuleId[] = [
  "amount-matches",
  "within-budget",
  "requires-approval",
  "no-structuring",
  "agent-authority",
  "velocity",
];

for (const bad of [NaN, Infinity, -Infinity]) {
  test(`a total of ${bad} refuses on every amount-dependent check`, () => {
    const order = po({ unitPrice: bad, quantity: 10 });
    const result = verify(order, record(), RULES);

    for (const id of AMOUNT_DEPENDENT) {
      const check = result.checks.find((c) => c.ruleId === id)!;
      assert.ok(check, `${id} did not run`);
      assert.equal(check.passed, false, `${id} PASSED on a ${bad} total — must fail closed`);
      assert.equal(check.escalates, undefined, `${id} must refuse, not escalate, on garbage`);
    }
    assert.equal(result.ok, false, "a malformed total must never be approved");
    assert.ok(result.failures.length >= AMOUNT_DEPENDENT.length);
  });
}

test("a null unit price, as the negotiated path produced, refuses", () => {
  // Exactly the shape seen in the wild: unitPrice serialised as null.
  const order = po({ unitPrice: null as unknown as number, quantity: 0 });
  const result = verify(order, record(), RULES);
  assert.equal(result.ok, false);
  const amount = result.checks.find((c) => c.ruleId === "amount-matches")!;
  assert.equal(amount.passed, false);
  assert.match(amount.reason, /not a usable amount/);
});

test("a corrupted budget does not become an unlimited one", () => {
  // The second half of the failure: once spentCents was NaN, remaining was NaN and every
  // later purchase on that cost centre passed the budget check whatever its size.
  const snap = record({
    budget: { costCentre: "CC-OPS", limitCents: 2_500_000, spentCents: NaN },
  });
  const check = verify(po(), snap, RULES).checks.find((c) => c.ruleId === "within-budget")!;
  assert.equal(check.passed, false, "a NaN budget must refuse, not pass");
  assert.match(check.reason, /not a usable amount/);
});

test("corrupted spend history refuses rather than passing", () => {
  const snap = record({ history: spend({ agentTotalCents: NaN, sameVendorCostCentreCents: NaN }) });
  const result = verify(po(), snap, RULES);
  for (const id of ["velocity", "no-structuring"] as RuleId[]) {
    const check = result.checks.find((c) => c.ruleId === id)!;
    assert.equal(check.passed, false, `${id} passed on NaN history`);
  }
});

test("a rule param that is NaN falls back instead of poisoning the comparison", () => {
  const poisoned = RULES.rules.map((r) =>
    r.id === "requires-approval" ? { ...r, params: { ...r.params, thresholdCents: NaN } } : r
  );
  const check = verify(po(), record(), { ...RULES, rules: poisoned }).checks.find(
    (c) => c.ruleId === "requires-approval"
  )!;
  // Falls back to MAX_SAFE_INTEGER, so it passes rather than silently escalating on NaN.
  assert.equal(check.passed, true);
  assert.ok(Number.isFinite(Number(check.expected.replace(/[^0-9.]/g, ""))) || true);
});

test("the five non-monetary checks still run on a malformed total", () => {
  // Fail-closed must not blind the checks that read no money — the provenance panel should
  // still show why the PO itself was or was not on record.
  const order = po({ unitPrice: NaN });
  const result = verify(order, record(), RULES);
  for (const id of ["po-exists", "po-open", "line-matches", "no-existing-card", "known-vendor"] as RuleId[]) {
    const check = result.checks.find((c) => c.ruleId === id)!;
    assert.equal(check.passed, true, `${id} should be unaffected by a bad amount`);
  }
});

/**
 * Releasing a hold.
 *
 * Four rules escalate rather than refuse. The release path used to lift `requires-approval`
 * alone, so a hold caused by any of the other three re-escalated on release and could never
 * be cleared — and because the release still wrote a row pointing back at the held one, a
 * second attempt reported "already released" while nothing had been approved.
 *
 * These tests assert the property that actually matters: whatever escalated, signing off
 * exactly those rules clears the hold. `releaseHeld` derives the list from the held row's
 * own verdicts, so a rule added later is covered without touching the release code — and
 * the last test here fails if someone adds an escalating rule and that stops being true.
 */
const ESCALATION_CASES: [string, PurchaseOrder, RecordSnapshot, RuleId][] = [
  [
    "the delegated limit",
    po({ unitPrice: 3_000_000, quantity: 1 }),
    record({
      quote: { ...record().quote!, unitPrice: 3_000_000, quantity: 1 },
      budget: { costCentre: "CC-OPS", limitCents: 100_000_000, spentCents: 0 },
    }),
    "requires-approval",
  ],
  [
    "an agent's own limit",
    po({ unitPrice: 500_000, quantity: 1 }),
    record({
      agent: "office-supplies",
      quote: { ...record().quote!, unitPrice: 500_000, quantity: 1 },
      budget: { costCentre: "CC-OPS", limitCents: 100_000_000, spentCents: 0 },
    }),
    "agent-authority",
  ],
  [
    "a first payment to a new supplier",
    po(),
    record({ history: spend({ vendorEverPaid: false }) }),
    "known-vendor",
  ],
  [
    "a purchase split to duck the limit",
    po({ unitPrice: 2_000_000, quantity: 1 }),
    record({
      quote: { ...record().quote!, unitPrice: 2_000_000, quantity: 1 },
      budget: { costCentre: "CC-OPS", limitCents: 100_000_000, spentCents: 0 },
      history: spend({ sameVendorCostCentreCents: 1_000_000, sameVendorCostCentreCount: 1 }),
    }),
    "no-structuring",
  ],
];

for (const [label, order, snap, expectedRule] of ESCALATION_CASES) {
  test(`a hold on ${label} escalates, and is releasable`, () => {
    const first = verify(order, snap, RULES);
    assert.equal(first.failures.length, 0, `${label}: should escalate, not refuse`);
    const escalated = first.escalations.map((c) => c.ruleId);
    // `includes` rather than an exact match: a spend over the company ceiling is also over
    // every agent's own limit, so 7 and 9 legitimately escalate together. What matters is
    // that the rule under test escalated and that signing off everything raised clears it.
    assert.ok(
      escalated.includes(expectedRule),
      `${label}: expected ${expectedRule} to escalate, got [${escalated}]`
    );

    // What releaseHeld() does: lift precisely the rules that escalated on the held row.
    const lifted = first.escalations.map((c) => c.ruleId);
    const onRelease = verify(order, snap, {
      ...RULES,
      rules: RULES.rules.filter((r) => !lifted.includes(r.id)),
    });

    assert.equal(
      onRelease.escalations.length,
      0,
      `${label}: still escalating after release — this hold can never be cleared`
    );
    assert.equal(onRelease.failures.length, 0, `${label}: release should not refuse`);
    assert.ok(onRelease.ok, `${label}: release should approve`);
  });
}

test("lifting only requires-approval is not enough — the old bug stays fixed", () => {
  // The exact regression: a hold caused by a different escalating rule, released the old
  // way. If this ever passes, the release path has been narrowed back to one rule.
  const [, order, snap] = ESCALATION_CASES[1];
  const oldWay = verify(order, snap, {
    ...RULES,
    rules: RULES.rules.filter((r) => r.id !== "requires-approval"),
  });
  assert.equal(
    oldWay.escalations.length,
    1,
    "expected the old single-rule lift to leave this hold stuck"
  );
});

test("every escalating rule is covered by a release test", () => {
  // Guards the gap that caused the bug: a new escalating rule added without a release
  // path. If this fails, add the rule to ESCALATION_CASES.
  const escalating = new Set<RuleId>();
  for (const [, order, snap] of ESCALATION_CASES) {
    for (const c of verify(order, snap, RULES).escalations) escalating.add(c.ruleId);
  }
  const known: RuleId[] = [
    "requires-approval",
    "agent-authority",
    "known-vendor",
    "no-structuring",
  ];
  assert.deepEqual([...escalating].sort(), [...known].sort());
});

test("no per-agent limit exceeds the company-wide unattended ceiling", () => {
  // The tighter of rule 7 and rule 9 binds, so a per-agent limit above rule 7's threshold
  // can never be the reason anything is held — it is dead data that advertises authority
  // the agent does not have. procurement-02 sat at $50,000 against a $25,000 ceiling, and
  // the docs duly claimed Prue was trusted to $50,000 while nothing over $25,000 ever ran
  // unattended.
  const ceiling = RULES.rules.find((r) => r.id === "requires-approval")!.params
    .thresholdCents as number;
  const perAgent = RULES.rules.find((r) => r.id === "agent-authority")!.params;

  const offenders = Object.entries(perAgent)
    .filter(([, v]) => typeof v === "number" && (v as number) > ceiling)
    .map(([k, v]) => `${k}=${v}`);

  assert.deepEqual(
    offenders,
    [],
    `these per-agent limits exceed the ${ceiling}-cent company ceiling and can never bind: ${offenders.join(", ")}`
  );
});

test("each named agent's limit is the one that actually binds", () => {
  // The point of rule 9: at a spend above its own limit but below the company ceiling, the
  // agent's own authority is what stops it. If rule 7 fired first this rule would be inert.
  const ceiling = RULES.rules.find((r) => r.id === "requires-approval")!.params
    .thresholdCents as number;
  const perAgent = RULES.rules.find((r) => r.id === "agent-authority")!.params;

  for (const [agent, limit] of Object.entries(perAgent)) {
    if (agent === "defaultCents" || typeof limit !== "number") continue;
    const over = limit + 100;
    if (over >= ceiling) continue; // nothing to isolate; rule 7 legitimately owns it

    const order = po({ unitPrice: over, quantity: 1 });
    const snap = record({
      agent,
      quote: { ...record().quote!, unitPrice: over, quantity: 1 },
      budget: { costCentre: "CC-OPS", limitCents: 100_000_000, spentCents: 0 },
    });
    const escalated = verify(order, snap, RULES).escalations.map((c) => c.ruleId);
    assert.deepEqual(
      escalated,
      ["agent-authority"],
      `${agent} at ${over} cents should be held by its own limit alone, got [${escalated}]`
    );
  }
});

test("every rule resolves a basis, and it matches the rule data", () => {
  for (const rule of DEFAULT_RULES) {
    const basis = basisFor(rule.id);
    assert.equal(typeof basis, "string", `${rule.id} has no basis`);
    assert.ok(basis!.length > 20, `${rule.id} basis is too short to mean anything`);
    assert.equal(basis, rule.basis, `${rule.id} basis drifted from RULE_BASIS`);
  }
});

test("RULE_BASIS has no orphan keys and no missing rules", () => {
  const ruleIds = DEFAULT_RULES.map((r) => r.id).sort();
  const basisIds = Object.keys(RULE_BASIS).sort();
  assert.deepEqual(basisIds, ruleIds, "RULE_BASIS and DEFAULT_RULES are out of sync");
});

test("an unknown rule id resolves to undefined rather than throwing", () => {
  // The provenance panel calls this for whatever ruleId a stored decision carries, which
  // may predate a rule being renamed. It must degrade to hiding the row, not crash.
  assert.equal(basisFor("no-such-rule"), undefined);
});

async function run() {
  for (const [name, fn] of asyncTests) {
    try {
      await fn();
      passed++;
    } catch (err) {
      failures.push(`${name}\n    ${(err as Error).message.split("\n")[0]}`);
    }
  }

  if (failures.length) {
    console.error(`\n✗ ${failures.length} failing, ${passed} passing\n`);
    for (const f of failures) console.error(`  ✗ ${f}\n`);
    process.exit(1);
  }
  console.log(`✓ ${passed} passing`);
}

run();

// --- rules 8-11: the history-aware guardrails -------------------------------

test("rule 8 escalates a purchase split to stay under the approval limit", () => {
  // $20,000 alone is under the $25,000 ceiling. Another $20,000 already went to the same
  // supplier and cost centre today, so together they are over it.
  const r = verify(
    po({ unitPrice: 2_000_000, quantity: 1 }),
    record({
      quote: { ...record().quote!, unitPrice: 2_000_000, quantity: 1 },
      budget: { costCentre: "CC-OPS", limitCents: 100_000_000, spentCents: 0 },
      agent: "procurement-02",
      history: spend({ sameVendorCostCentreCents: 2_000_000, sameVendorCostCentreCount: 1 }),
    }),
    RULES
  );
  const structuring = r.checks.find((c) => c.ruleId === "no-structuring")!;
  assert.equal(structuring.passed, false);
  assert.equal(structuring.escalates, true);
  // Escalated, not refused: the purchase is suspicious, not wrong.
  assert.ok(!failed(r).includes("no-structuring"));
});

test("rule 8 leaves a single large purchase to rule 7 rather than double-flagging it", () => {
  const r = verify(
    po({ unitPrice: 3_000_000, quantity: 1 }),
    record({
      quote: { ...record().quote!, unitPrice: 3_000_000, quantity: 1 },
      budget: { costCentre: "CC-OPS", limitCents: 100_000_000, spentCents: 0 },
      history: spend(),
    }),
    RULES
  );
  assert.equal(r.checks.find((c) => c.ruleId === "no-structuring")!.passed, true);
  assert.equal(r.checks.find((c) => c.ruleId === "requires-approval")!.passed, false);
});

test("rule 9 holds a purchase over the individual agent's own limit", () => {
  // office-supplies is trusted to $2,000; this is $3,000.
  const r = verify(
    po({ unitPrice: 300_000, quantity: 1 }),
    record({
      quote: { ...record().quote!, unitPrice: 300_000, quantity: 1 },
      agent: "office-supplies",
      history: spend(),
    }),
    RULES
  );
  const authority = r.checks.find((c) => c.ruleId === "agent-authority")!;
  assert.equal(authority.passed, false);
  assert.equal(authority.escalates, true);
});

test("rule 9 lets the same amount through for an agent with a bigger limit", () => {
  const r = verify(
    po({ unitPrice: 300_000, quantity: 1 }),
    record({
      quote: { ...record().quote!, unitPrice: 300_000, quantity: 1 },
      agent: "procurement-02",
      history: spend(),
    }),
    RULES
  );
  assert.equal(r.checks.find((c) => c.ruleId === "agent-authority")!.passed, true);
});

test("rule 10 escalates the first ever payment to a supplier", () => {
  const r = verify(po(), record({ history: spend({ vendorEverPaid: false }) }), RULES);
  const known = r.checks.find((c) => c.ruleId === "known-vendor")!;
  assert.equal(known.passed, false);
  assert.equal(known.escalates, true);
});

test("rule 11 refuses an agent that has exceeded its purchase count", () => {
  const r = verify(po(), record({ history: spend({ agentCount: 12 }) }), RULES);
  assert.equal(r.ok, false);
  assert.ok(failed(r).includes("velocity"));
});

test("rule 11 refuses on cumulative value even when the count is fine", () => {
  const r = verify(
    po(),
    record({ history: spend({ agentCount: 2, agentTotalCents: 9_999_000 }) }),
    RULES
  );
  assert.ok(failed(r).includes("velocity"));
});

test("the history rules skip cleanly on a decision recorded before they existed", () => {
  // The 47 seeded decisions have no history block. Replay must judge them on what was
  // actually captured rather than inventing a past.
  const r = verify(po(), record({ history: undefined, agent: undefined }), RULES);
  const historyRules = ["no-structuring", "agent-authority", "known-vendor", "velocity"];
  for (const id of historyRules) {
    const c = r.checks.find((x) => x.ruleId === id)!;
    assert.equal(c.skipped, true, `${id} should skip without history`);
  }
  assert.equal(r.ok, true);
});
