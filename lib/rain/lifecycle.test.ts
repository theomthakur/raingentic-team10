/**
 * Tests for the Rain sandbox lifecycle: collateral funding, transaction reading, and card
 * retirement. Run with `tsx lib/rain/lifecycle.test.ts`.
 *
 * These target the ways this code could be *dishonest* rather than merely broken, since
 * that is the failure that would actually cost us:
 *
 *  1. Funding reporting success it did not get, or acting on an amount it never checked.
 *  2. The transaction projection leaking cardholder identity or card credentials into a
 *     browser response. This is asserted against a fixture built from Rain's real `spend`
 *     schema, with the PII fields present, so the test fails if someone widens the
 *     projection later.
 *  3. Retirement reporting a dead card without Rain having said so, and the `canceled`
 *     spelling silently regressing to `cancelled`, which Rain rejects.
 */
import assert from "node:assert/strict";
import {
  MAX_FUND_CENTS,
  readCollateralConfig,
  validateFundAmount,
} from "./collateral";
import { DEFAULT_LIMIT, MAX_LIMIT, toSafeTransaction, validateLimit } from "./transactions";
import {
  CARD_STATUSES,
  RETIRED_STATUS,
  isCardStatus,
  retireCard,
  validateCardId,
} from "./card-retirement";

let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  const record = (err: unknown) =>
    failures.push(`${name}\n    ${(err as Error).message.split("\n")[0]}`);
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(() => void passed++, record);
    }
    passed++;
  } catch (err) {
    record(err);
  }
  return Promise.resolve();
}

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

const pending: Promise<unknown>[] = [];

// --- collateral: amount validation ---------------------------------------------------

pending.push(
  test("a whole number of cents is accepted", () => {
    const r = validateFundAmount(10_000);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.amountCents, 10_000);
  }),

  test("a decimal is rejected rather than rounded", () => {
    // Rounding here would silently change the amount funded. Better to make the caller say
    // what it means.
    const r = validateFundAmount(100.5);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.error.includes("whole number"));
  }),

  test("zero and negatives are rejected", () => {
    assert.equal(validateFundAmount(0).ok, false);
    assert.equal(validateFundAmount(-500).ok, false);
  }),

  test("strings are rejected, so no coercion happens on the way to Rain", () => {
    assert.equal(validateFundAmount("10000").ok, false);
    assert.equal(validateFundAmount("$100").ok, false);
  }),

  test("missing, null, NaN and Infinity are rejected", () => {
    assert.equal(validateFundAmount(undefined).ok, false);
    assert.equal(validateFundAmount(null).ok, false);
    assert.equal(validateFundAmount(Number.NaN).ok, false);
    assert.equal(validateFundAmount(Number.POSITIVE_INFINITY).ok, false);
  }),

  test("an amount past our own ceiling is rejected, catching a mistyped zero", () => {
    const r = validateFundAmount(MAX_FUND_CENTS + 1);
    assert.equal(r.ok, false);
  }),

  test("exactly the ceiling is allowed", () => {
    assert.equal(validateFundAmount(MAX_FUND_CENTS).ok, true);
  }),

  // --- collateral: configuration -----------------------------------------------------

  test("no API key reports as not configured", () => {
    withEnv({ RAIN_API_KEY: undefined, RAIN_COLLATERAL_CONTRACT_ID: "c-1" }, () => {
      const c = readCollateralConfig();
      assert.equal(c.configured, false);
      if (!c.configured) assert.ok(c.reason.includes("RAIN_API_KEY"));
    });
  }),

  test("no contract id reports as not configured, and names the variable", () => {
    withEnv({ RAIN_API_KEY: "test-key", RAIN_COLLATERAL_CONTRACT_ID: undefined }, () => {
      const c = readCollateralConfig();
      assert.equal(c.configured, false);
      if (!c.configured) assert.ok(c.reason.includes("RAIN_COLLATERAL_CONTRACT_ID"));
    });
  }),

  test("a whitespace contract id counts as absent", () => {
    withEnv({ RAIN_API_KEY: "test-key", RAIN_COLLATERAL_CONTRACT_ID: "   " }, () => {
      assert.equal(readCollateralConfig().configured, false);
    });
  }),

  test("the unconfigured path never falls back to some other tenant's contract", () => {
    withEnv({ RAIN_API_KEY: "test-key", RAIN_COLLATERAL_CONTRACT_ID: undefined }, () => {
      const c = readCollateralConfig();
      assert.equal("contractId" in c, false);
    });
  }),

  test("both variables present reports as configured", () => {
    withEnv(
      { RAIN_API_KEY: "test-key", RAIN_COLLATERAL_CONTRACT_ID: "3f9a1c02-77bd-4a11-9c33-0ac1d5e2b7f4" },
      () => {
        const c = readCollateralConfig();
        assert.equal(c.configured, true);
        if (c.configured) assert.equal(c.contractId, "3f9a1c02-77bd-4a11-9c33-0ac1d5e2b7f4");
      }
    );
  }),

  // --- transactions: limit validation ------------------------------------------------

  test("an absent limit falls back to the documented default", () => {
    const r = validateLimit(undefined);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.limit, DEFAULT_LIMIT);
  }),

  test("a numeric query string is accepted, since that is how it arrives", () => {
    const r = validateLimit("50");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.limit, 50);
  }),

  test("zero, negatives and values past Rain's maximum are rejected", () => {
    assert.equal(validateLimit(0).ok, false);
    assert.equal(validateLimit(-1).ok, false);
    assert.equal(validateLimit(MAX_LIMIT + 1).ok, false);
  }),

  test("the boundaries themselves are allowed", () => {
    assert.equal(validateLimit(1).ok, true);
    assert.equal(validateLimit(MAX_LIMIT).ok, true);
  }),

  test("non-numeric and fractional limits are rejected", () => {
    assert.equal(validateLimit("abc").ok, false);
    assert.equal(validateLimit(2.5).ok, false);
    assert.equal(validateLimit({}).ok, false);
  }),

  // --- transactions: the projection --------------------------------------------------

  test("a spend transaction keeps the fields needed to explain it", () => {
    const safe = toSafeTransaction({
      id: "txn_1",
      type: "spend",
      spend: {
        amount: 4599,
        currency: "usd",
        merchantName: "Northwind Components",
        merchantCategory: "industrial_supplies",
        merchantCategoryCode: "5085",
        cardId: "card_9",
        status: "approved",
        authorizedAt: "2026-08-09T14:02:11.000Z",
      },
    });
    assert.ok(safe);
    assert.equal(safe.amountCents, 4599);
    assert.equal(safe.merchantName, "Northwind Components");
    assert.equal(safe.cardId, "card_9");
    assert.equal(safe.status, "approved");
  }),

  test("cardholder identity is dropped, even though Rain sends it", () => {
    const safe = toSafeTransaction({
      id: "txn_2",
      type: "spend",
      spend: {
        amount: 1200,
        currency: "usd",
        merchantName: "Acme",
        userId: "user_1",
        userFirstName: "Priya",
        userEmail: "priya@example.com",
      },
    });
    assert.ok(safe);
    const keys = Object.keys(safe);
    for (const leaked of ["userFirstName", "userEmail", "userId"]) {
      assert.equal(keys.includes(leaked), false, `${leaked} must not be in the projection`);
    }
    assert.equal(JSON.stringify(safe).includes("priya@example.com"), false);
    assert.equal(JSON.stringify(safe).includes("Priya"), false);
  }),

  test("card credentials never survive the projection, whatever the shape", () => {
    const safe = toSafeTransaction({
      id: "txn_3",
      type: "spend",
      pan: "4111111111111111",
      cvc: "123",
      spend: { amount: 100, pan: "4111111111111111", cvc: "123", expiryMonth: "12" },
    });
    assert.ok(safe);
    const serialized = JSON.stringify(safe);
    assert.equal(serialized.includes("4111111111111111"), false);
    assert.equal(serialized.includes("cvc"), false);
    assert.equal(serialized.includes("expiry"), false);
  }),

  test("a non-spend type still produces a row instead of vanishing", () => {
    // A transaction we cannot fully read is still a transaction that happened. Dropping it
    // would make the list quietly incomplete, which is worse than a sparse row.
    const safe = toSafeTransaction({
      id: "txn_4",
      type: "collateral",
      collateral: { amount: 500_000, currency: "rusd" },
    });
    assert.ok(safe);
    assert.equal(safe.type, "collateral");
    assert.equal(safe.amountCents, 500_000);
    assert.equal(safe.merchantName, null);
  }),

  test("an unrecognised type is reported, not guessed at", () => {
    const safe = toSafeTransaction({ id: "txn_5" });
    assert.ok(safe);
    assert.equal(safe.type, "unknown");
  }),

  test("junk without an id is discarded rather than rendered as an empty row", () => {
    assert.equal(toSafeTransaction(null), null);
    assert.equal(toSafeTransaction("txn_6"), null);
    assert.equal(toSafeTransaction({ type: "spend" }), null);
  }),

  // --- card retirement -----------------------------------------------------------------

  test("the retired status is the spelling Rain actually accepts", () => {
    // One L. `cancelled` is rejected by Rain's schema, and that single letter is the whole
    // reason this looked unimplementable at first.
    assert.equal(RETIRED_STATUS, "canceled");
    assert.equal(CARD_STATUSES.includes("cancelled" as never), false);
  }),

  test("only the three probe-confirmed statuses are treated as valid", () => {
    for (const ok of ["active", "locked", "canceled"]) assert.equal(isCardStatus(ok), true);
    for (const bad of ["cancelled", "inactive", "frozen", "deleted", "", null]) {
      assert.equal(isCardStatus(bad), false);
    }
  }),

  test("a non-uuid card id is rejected before any call is made", () => {
    assert.equal(validateCardId("card_9").ok, false);
    assert.equal(validateCardId("").ok, false);
    assert.equal(validateCardId("   ").ok, false);
    assert.equal(validateCardId(undefined).ok, false);
    assert.equal(validateCardId(12345).ok, false);
  }),

  test("a real uuid is accepted and trimmed", () => {
    const r = validateCardId("  c007cda9-5d56-4159-b232-85105c18ad46  ");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.cardId, "c007cda9-5d56-4159-b232-85105c18ad46");
  }),

  test("retirement without an API key throws rather than reporting a retired card", async () => {
    // The failure that would actually matter: claiming a card is dead when nothing was
    // ever called.
    const previous = process.env.RAIN_API_KEY;
    delete process.env.RAIN_API_KEY;
    try {
      await assert.rejects(() => retireCard("c007cda9-5d56-4159-b232-85105c18ad46"));
    } finally {
      if (previous !== undefined) process.env.RAIN_API_KEY = previous;
    }
  })
);

// --- report --------------------------------------------------------------------------

void Promise.all(pending).then(() => {
  if (failures.length) {
    console.error(`\n✗ ${failures.length} failing, ${passed} passing\n`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(`\n✓ ${passed} passing (rain lifecycle)`);
});
