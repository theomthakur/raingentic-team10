/**
 * Tests for the sandbox payment-route rail. `tsx lib/rain/payment-routes.test.ts`.
 *
 * Two properties are worth protecting here, and neither is about happy-path plumbing:
 *
 *  1. An amount is validated against Rain's own contract before a network call, including
 *     the $2 floor and the no-floats rule.
 *  2. Missing configuration reports itself as missing. The failure mode that would
 *     actually matter — claiming a transfer happened when nothing was configured — is
 *     tested explicitly, because that is the one bug here that would be dishonest rather
 *     than merely broken.
 */
import assert from "node:assert/strict";
import { MINIMUM_TRANSFER_USD, readConfig, validateAmount } from "./payment-routes";

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

/** Run `fn` with a temporary environment, restoring whatever was there afterwards. */
function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// --- amount validation -------------------------------------------------------------

test("a plain decimal string is accepted and passed through untouched", () => {
  const r = validateAmount("25.00");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.amountUsd, "25.00");
});

test("whole numbers are accepted", () => {
  const r = validateAmount("100");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.amountUsd, "100");
});

test("surrounding whitespace is trimmed rather than rejected", () => {
  const r = validateAmount("  50.25  ");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.amountUsd, "50.25");
});

test("a number is rejected, because formatting it here would introduce float rounding", () => {
  assert.equal(validateAmount(25 as unknown).ok, false);
});

test("currency symbols and thousands separators are rejected", () => {
  assert.equal(validateAmount("$25").ok, false);
  assert.equal(validateAmount("1,500").ok, false);
});

test("negatives and non-numeric strings are rejected", () => {
  assert.equal(validateAmount("-10").ok, false);
  assert.equal(validateAmount("abc").ok, false);
  assert.equal(validateAmount("").ok, false);
});

test("missing and null amounts are rejected", () => {
  assert.equal(validateAmount(undefined).ok, false);
  assert.equal(validateAmount(null).ok, false);
});

test("Rain's minimum is enforced before a call is made", () => {
  const r = validateAmount("1.99");
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.error.includes(String(MINIMUM_TRANSFER_USD)));
});

test("exactly the minimum is allowed", () => {
  assert.equal(validateAmount(String(MINIMUM_TRANSFER_USD)).ok, true);
});

// --- configuration -----------------------------------------------------------------

test("no API key reports as not configured", () => {
  withEnv({ RAIN_API_KEY: undefined, RAIN_PAYMENT_ROUTE_ID: "route-1" }, () => {
    const s = readConfig();
    assert.equal(s.configured, false);
    if (!s.configured) assert.ok(s.reason.includes("RAIN_API_KEY"));
  });
});

test("no route id reports as not configured, and says why", () => {
  withEnv({ RAIN_API_KEY: "test-key", RAIN_PAYMENT_ROUTE_ID: undefined }, () => {
    const s = readConfig();
    assert.equal(s.configured, false);
    if (!s.configured) assert.ok(s.reason.includes("RAIN_PAYMENT_ROUTE_ID"));
  });
});

test("an empty or whitespace route id counts as absent, not as a route", () => {
  withEnv({ RAIN_API_KEY: "test-key", RAIN_PAYMENT_ROUTE_ID: "   " }, () => {
    assert.equal(readConfig().configured, false);
  });
});

test("the not-configured path never invents a destination", () => {
  withEnv({ RAIN_API_KEY: "test-key", RAIN_PAYMENT_ROUTE_ID: undefined }, () => {
    const s = readConfig();
    assert.equal(s.configured, false);
    // The whole point: no fallback route, no default wallet, no placeholder id.
    assert.equal("config" in s, false);
  });
});

test("both variables present reports as configured", () => {
  withEnv({ RAIN_API_KEY: "test-key", RAIN_PAYMENT_ROUTE_ID: "a7f2c5b1-9e8d-4c3a-bb22-12c0a4d5b8f9" }, () => {
    const s = readConfig();
    assert.equal(s.configured, true);
    if (s.configured) {
      assert.equal(s.config.paymentRouteId, "a7f2c5b1-9e8d-4c3a-bb22-12c0a4d5b8f9");
    }
  });
});

// --- report --------------------------------------------------------------------------

if (failures.length) {
  console.error(`\n✗ ${failures.length} failing, ${passed} passing\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\n✓ ${passed} passing (payment routes)`);
