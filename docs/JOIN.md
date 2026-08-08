# The 17:00 join, in one page

B's half is built and tested. This is everything A needs to wire the Rain side in, and it
is deliberately one function.

---

## What already works

- The eleven checks, `verify(po, record, ruleSet) -> { ok, checks, failures }`, pure, 78 tests
- Rules as versioned data, a new version on every edit, sha256 per version
- Append-only decision log, storing a **snapshot** of the record rather than a pointer
- Replay across 54 seeded decisions plus everything the demo adds
- The full pipeline, `PROPOSE → VERIFY → ISSUE → SETTLE → RECORD`, with the refusal branch
- The console: decision feed, provenance panel, rule editor, replay diff, budget meters
- The run-it-twice demo path, verified end to end

Right now `ISSUE` returns a **simulated** card and the UI says so, in the header badge and
on every stage line. Nothing overstates what happened.

---

## 🔴 The seam: `lib/rain/issuer.ts`

One function. Replace its body, change nothing else.

```ts
async function issueViaRain(req: IssueRequest): Promise<IssuedCard>
```

**In:**

```ts
interface IssueRequest {
  po: PurchaseOrder;   // poNumber, vendor, sku, unitPrice, quantity, quoteExpiry, costCentre
  limitCents: number;  // exactly the approved total. Not rounded, not a standing limit.
}
```

**Out:**

```ts
interface IssuedCard {
  cardId: string;
  last4: string;
  limitCents: number;
  expiresAt: string;   // ISO. No later than po.quoteExpiry.
  simulated: boolean;  // false once it is a real Rain card
}
```

Scope the card to `req.limitCents`, single use, expiry no later than `req.po.quoteExpiry`,
and merchant-locked to `req.po.vendor` if the endpoint supports it.

`issueCard()` already falls back to the simulator if `RAIN_API_KEY` is absent or the call
throws, so a credential problem degrades the demo instead of breaking it — but it will
never claim a real card it did not get.

**The guarantee to keep:** `issueViaRain` is only ever reached after `verify()` returned
ok. A refusal does not call it. That is the whole thesis, and it is enforced by the shape
of `lib/pipeline.ts`, not by a flag.

---

## Where the agent's PO plugs in

`POST /api/run` takes either `{ taskId }` (the canned demo tasks) or
`{ po, agent }`. Point the agent at the second form:

```ts
await fetch("/api/run", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ agent: "procurement-01", po }),
});
```

It returns `{ decision, stages }`. Same code path either way — there is no demo-mode branch,
which is what lets a judge type their own PO into the form and hit the real pipeline.

If the quote stage survives the cut, it runs **upstream** of this and its winning quote
becomes the `po`. Nothing here changes.

---

## The Monad rule-version anchor

Rule versions are already hashed. `RuleSet.hash` is a sha256 over the canonical rule JSON,
stable regardless of key or rule order, and there is a `RuleSet.anchorTxHash` field plus
`store.setAnchor(version, txHash)` waiting for it.

So the anchor is: read `hash`, write it to Monad testnet, call `setAnchor`. One transaction
per **version**, not per decision — a handful of writes, not hundreds.

Why this one rather than a per-decision anchor: replay proves the rules are data, but it
does not prove the rules were not edited afterwards to fit the history. An independent
timestamp on each version closes that hole, which makes the chain structural rather than
decorative. The UI already shows `anchored` / `local` per version.

---

## What is left that B owns

- Card revoke in the UI once A confirms the endpoint exists (stage 7)
- Deploy, and **verify replay on the deployed URL from a phone** with `DATABASE_URL` set

## What to check before the demo

- [ ] `DATABASE_URL` set on the deployed build — without it the log empties on a cold start
- [ ] Run-it-twice works on the deployed URL, not just localhost
- [ ] `git ls-files | grep -i env` returns only `.env.local.example`
- [ ] Reset demo button restores the seeded 54 so it can be re-run for a second judge
