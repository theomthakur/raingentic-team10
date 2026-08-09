/**
 * Tests for the conditional treasury payout. `tsx lib/rain/treasury.test.ts`.
 *
 * The properties worth protecting are about honesty, not plumbing:
 *
 *  1. A payout cannot be requested without naming the rule that authorises it. If the
 *     condition were droppable, the word "conditional" would be decoration.
 *  2. The authorization digest is deterministic, and distinct inputs cannot collide into the
 *     same one — including through separator characters smuggled into a field.
 *  3. An accepted result reports only what Rain returned. Missing ids stay null, `settled`
 *     stays false, and the wording never graduates from accepted to settled.
 *  4. A missing route reports itself missing, and never invents a destination.
 */
import assert from "node:assert/strict";
import {
  MINIMUM_TRANSFER_USD,
  SANDBOX_DISCLAIMER,
  acceptedResult,
  authorize,
  railsFrom,
  requestPayout,
  validatePayoutRequest,
} from "./treasury";

let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  const record = (err: unknown) =>
    failures.push(`${name}\n    ${(err as Error).message.split("\n")[0]}`);
  try {
    const result = fn();
    if (result instanceof Promise) return result.then(() => void passed++, record);
    passed++;
  } catch (err) {
    record(err);
  }
  return Promise.resolve();
}

function withEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const restore = () => {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  try {
    const out = fn();
    if (out instanceof Promise) return out.finally(restore);
    restore();
  } catch (err) {
    restore();
    throw err;
  }
  return Promise.resolve();
}

const valid = { amountUsd: "25.00", purpose: "Quarterly rebalance", policyRef: "treasury.rebalance.v2" };
const pending: Promise<unknown>[] = [];

// --- the condition is required -------------------------------------------------------

pending.push(
  test("a fully stated payout validates", () => {
    const r = validatePayoutRequest(valid);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.request.amountUsd, "25.00");
      assert.equal(r.request.policyRef, "treasury.rebalance.v2");
    }
  }),

  test("a payout with no policy reference is refused", () => {
    // The whole claim of the feature. If this ever passes, the payout is unconditional.
    const { policyRef, ...withoutPolicy } = valid;
    void policyRef;
    const r = validatePayoutRequest(withoutPolicy);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.includes("policyRef"));
  }),

  test("an empty or whitespace policy reference does not count as one", () => {
    assert.equal(validatePayoutRequest({ ...valid, policyRef: "" }).ok, false);
    assert.equal(validatePayoutRequest({ ...valid, policyRef: "   " }).ok, false);
  }),

  test("a policy reference must look like an identifier, not prose", () => {
    assert.equal(validatePayoutRequest({ ...valid, policyRef: "because I said so" }).ok, false);
    assert.equal(validatePayoutRequest({ ...valid, policyRef: "ab" }).ok, false);
    assert.equal(validatePayoutRequest({ ...valid, policyRef: "x".repeat(65) }).ok, false);
    assert.equal(validatePayoutRequest({ ...valid, policyRef: "treasury:rebalance-v2.1" }).ok, true);
  }),

  test("a purpose is required and bounded", () => {
    const { purpose, ...withoutPurpose } = valid;
    void purpose;
    assert.equal(validatePayoutRequest(withoutPurpose).ok, false);
    assert.equal(validatePayoutRequest({ ...valid, purpose: "hi" }).ok, false);
    assert.equal(validatePayoutRequest({ ...valid, purpose: "x".repeat(141) }).ok, false);
  }),

  test("whitespace in a purpose is normalised rather than preserved", () => {
    const r = validatePayoutRequest({ ...valid, purpose: "  Quarterly   rebalance  " });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.request.purpose, "Quarterly rebalance");
  }),

  test("a newline in a purpose is flattened, not left in the hashed string", () => {
    const r = validatePayoutRequest({ ...valid, purpose: "line\nbreak here" });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.request.purpose, "line break here");
  }),

  test("non-whitespace control characters are rejected outright", () => {
    assert.equal(validatePayoutRequest({ ...valid, purpose: "null\u0000byte" }).ok, false);
    assert.equal(validatePayoutRequest({ ...valid, purpose: "delete\u007Fchar" }).ok, false);
  }),

  test("the canonical separator cannot be smuggled into a purpose", () => {
    // Otherwise `purpose=a|amountUsd=1` could impersonate a different field in the digest.
    assert.equal(validatePayoutRequest({ ...valid, purpose: "pipe | smuggling" }).ok, false);
  }),

  // --- amount rules ------------------------------------------------------------------

  test("a float is rejected, so no rounding is introduced into a money value", () => {
    assert.equal(validatePayoutRequest({ ...valid, amountUsd: 25.0 }).ok, false);
    assert.equal(validatePayoutRequest({ ...valid, amountUsd: 25 }).ok, false);
  }),

  test("malformed amounts are rejected", () => {
    for (const bad of ["$25", "1,500", "-10", "abc", "", "  ", "2.5.1", null, undefined]) {
      assert.equal(validatePayoutRequest({ ...valid, amountUsd: bad }).ok, false, String(bad));
    }
  }),

  test("Rain's minimum is enforced before any call is made", () => {
    const r = validatePayoutRequest({ ...valid, amountUsd: "1.99" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.includes(String(MINIMUM_TRANSFER_USD)));
  }),

  test("exactly the minimum is allowed", () => {
    assert.equal(validatePayoutRequest({ ...valid, amountUsd: String(MINIMUM_TRANSFER_USD) }).ok, true);
  }),

  test("a non-object body is rejected without throwing", () => {
    assert.equal(validatePayoutRequest(null).ok, false);
    assert.equal(validatePayoutRequest("25.00").ok, false);
    assert.equal(validatePayoutRequest([]).ok, false);
  }),

  // --- the authorization digest --------------------------------------------------------

  test("the digest is deterministic for the same authorised payout", () => {
    const a = authorize(valid, "route-1");
    const b = authorize({ ...valid }, "route-1");
    assert.equal(a.digest, b.digest);
    assert.match(a.digest, /^[0-9a-f]{64}$/);
  }),

  test("changing any part of the authorisation changes the digest", () => {
    const base = authorize(valid, "route-1").digest;
    assert.notEqual(authorize({ ...valid, policyRef: "treasury.other.v1" }, "route-1").digest, base);
    assert.notEqual(authorize({ ...valid, purpose: "Something else" }, "route-1").digest, base);
    assert.notEqual(authorize({ ...valid, amountUsd: "25.01" }, "route-1").digest, base);
    // Same authorisation, different rail, is a different payout.
    assert.notEqual(authorize(valid, "route-2").digest, base);
  }),

  test("the canonical string is published so the digest can be recomputed", () => {
    const a = authorize(valid, "route-1");
    assert.equal(
      a.canonical,
      "policy=treasury.rebalance.v2|purpose=Quarterly rebalance|amountUsd=25.00|route=route-1"
    );
  }),

  // --- what an accepted result may say -------------------------------------------------

  test("an accepted result reports acceptance and never settlement", () => {
    const r = acceptedResult({
      request: valid,
      authorization: authorize(valid, "route-1"),
      route: { id: "route-1", status: "active", source: { rail: "ach", currency: "usd" }, destination: { rail: "base", currency: "usdc" } },
      simulation: { simulationId: "sim_1", flow: "usd_onramp", status: "processing" },
    });
    assert.equal(r.outcome, "accepted-by-rain-sandbox");
    assert.equal(r.settled, false);
    assert.equal(r.environment, "rain-sandbox");
    assert.ok(r.disclaimer.includes("no real funds moved"));
    const serialized = JSON.stringify(r).toLowerCase();
    assert.equal(serialized.includes("settled\":true"), false);
  }),

  test("both rails and the amount are carried through from Rain's own route", () => {
    const r = acceptedResult({
      request: valid,
      authorization: authorize(valid, "route-1"),
      route: { id: "route-1", source: { rail: "ach", currency: "usd" }, destination: { rail: "base", currency: "usdc" } },
      simulation: {},
    });
    assert.equal(r.rails.source.rail, "ach");
    assert.equal(r.rails.destination.rail, "base");
    assert.equal(r.rails.destination.currency, "usdc");
    assert.equal(r.amountUsd, "25.00");
    assert.equal(r.routeId, "route-1");
  }),

  test("an absent simulation id stays null instead of being invented", () => {
    const r = acceptedResult({
      request: valid,
      authorization: authorize(valid, "route-1"),
      route: { id: "route-1" },
      simulation: {},
    });
    assert.equal(r.simulationId, null);
    assert.equal(r.transferId, null);
    assert.equal(r.flow, null);
    // Rain returning no status still means accepted, since a rejection would have thrown.
    assert.equal(r.railStatus, "accepted");
  }),

  test("a transfer id is surfaced when Rain supplies one", () => {
    const r = acceptedResult({
      request: valid,
      authorization: authorize(valid, "route-1"),
      route: { id: "route-1" },
      simulation: { transferId: "tr_9" } as never,
    });
    assert.equal(r.transferId, "tr_9");
  }),

  test("the authorisation travels with the result as evidence", () => {
    const auth = authorize(valid, "route-1");
    const r = acceptedResult({ request: valid, authorization: auth, route: { id: "route-1" }, simulation: null });
    assert.equal(r.authorization.policyRef, "treasury.rebalance.v2");
    assert.equal(r.authorization.digest, auth.digest);
    assert.equal(r.authorization.canonical, auth.canonical);
  }),

  test("rails read as null when Rain reports none, rather than being guessed", () => {
    const rails = railsFrom({ id: "route-1" });
    assert.equal(rails.source.rail, null);
    assert.equal(rails.destination.currency, null);
  }),

  test("the disclaimer refuses the two claims that would matter", () => {
    assert.ok(SANDBOX_DISCLAIMER.includes("simulated"));
    assert.ok(SANDBOX_DISCLAIMER.includes("nothing has settled"));
  }),

  // --- unconfigured ----------------------------------------------------------------------

  test("a missing API key reports unconfigured and attempts nothing", async () => {
    await withEnv({ RAIN_API_KEY: undefined, RAIN_PAYMENT_ROUTE_ID: "route-1" }, async () => {
      const out = await requestPayout(valid);
      assert.equal(out.configured, false);
      if (!out.configured) assert.ok(out.reason.includes("RAIN_API_KEY"));
    });
  }),

  test("a missing route reports unconfigured and never invents a destination", async () => {
    await withEnv({ RAIN_API_KEY: "test-key", RAIN_PAYMENT_ROUTE_ID: undefined }, async () => {
      const out = await requestPayout(valid);
      assert.equal(out.configured, false);
      // The failure that would actually matter: a fabricated success with a made-up rail.
      assert.equal("result" in out, false);
      if (!out.configured) assert.ok(out.reason.includes("RAIN_PAYMENT_ROUTE_ID"));
    });
  }),

  test("a whitespace route id counts as absent", async () => {
    await withEnv({ RAIN_API_KEY: "test-key", RAIN_PAYMENT_ROUTE_ID: "   " }, async () => {
      assert.equal((await requestPayout(valid)).configured, false);
    });
  })
);

// --- report --------------------------------------------------------------------------

void Promise.all(pending).then(() => {
  if (failures.length) {
    console.error(`\n✗ ${failures.length} failing, ${passed} passing\n`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(`\n✓ ${passed} passing (treasury payout)`);
});
