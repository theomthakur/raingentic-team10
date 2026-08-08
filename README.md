# Mandate

**Rain bounds how much an agent spends and where. Mandate checks why — and if the reason
does not hold, no card is ever issued.**

Built for the Raingentic Commerce Hackathon NYC, Team 10.

---

## The argument

An agent with a card limited to $200 at office-supply merchants can buy entirely the wrong
thing, at an allowed price, from an allowed merchant, for a reason it invented. Every
control passes. The purchase is still wrong.

Rain's Agent Control Layer enforces its controls *"at card issuance rather than applied
after the fact."* Mandate takes that one level up. The agent must declare the purchase
order it negotiated **before** an instrument exists, and deterministic code checks that
declaration against the system of record.

A failure does not produce a declined transaction. It produces **no card at all**. There is
nothing to block, because nothing was created.

If that sounds like a database constraint: it is a **pre-issuance three-way match** — the
same PO / receipt / invoice reconciliation every ERP performs, moved from after the invoice
arrives, where the remedy is a dispute or a clawback, to before the card exists.

---

## Architecture

```
  1 TASK        agent is given a job
       |
  2 PROPOSE     agent declares the accepted PO
       |          { poNumber, vendor, sku, unitPrice, quantity, quoteExpiry }
       v
  3 VERIFY      deterministic checks against a snapshot     <-- no model here
       |          rules are versioned CONFIG, not code
       |
    pass|fail
       |    \
       |     \--> REFUSE   no card. plain-English reason. logged.
       v
  4 ISSUE       Rain issues a virtual card scoped to exactly this PO
       v
  5 SETTLE      purchase happens; the record is written back
       v
  6 RECORD      PO + snapshot + rule version + checks + outcome, append-only
```

```
- - - - - - - - - - PRODUCTION SCALE, NOT TODAY - - - - - - - - - -
webhook ingestion of authorizations  |  queue workers for issuance
audit log to a warehouse             |  per-tenant rule versioning
idempotency keys on every write      |  rule simulation against history
```

---

## The six rules

They live as **versioned data**, not as code. Every threshold on the policy screen is a row
in a table; nothing in `lib/checks` hardcodes a number.

| # | Rule | Catches |
|---|---|---|
| 1 | PO exists and is accepted | An agent inventing a justification outright |
| 2 | PO still open, quote unexpired | Paying twice for something already fulfilled |
| 3 | Amount matches the quote, within tolerance | Right vendor, wrong price |
| 4 | Vendor **and SKU** match the quote | Right vendor, right total, **wrong item** — no card control can express this at any granularity |
| 5 | Within the cost centre's remaining budget | Death by a thousand small correct purchases |
| 6 | No card already issued for this PO | Duplicate spend on a retry. The order line is the idempotency key |

Every check returns pass/fail **plus a sentence a person can act on**, never
"validation failed".

---

## The design decisions this rests on

1. **Rules are versioned data, never code.** Editing one writes the next version; the old
   one is never mutated.
2. **No model in the verify path.** Not only a safety argument — it is what makes replay
   possible. If a model made the call you could not re-run history, because you would not
   know whether a difference came from the new rule or the model's mood.
3. **Enforcement at issuance.** A failed check never creates the instrument.
4. **Store a snapshot of the record, not a pointer.** Records change. Replaying a pointer
   six hours later re-judges today's facts, which is a new decision, not a replay.
5. **One card per order line, keyed for idempotency.** In Postgres the order line is
   literally the primary key of `issued_cards`, so a double-issue is impossible even under
   a concurrent retry.
6. **The decision log is append-only.** Nothing updated in place, nothing deleted.

Decisions 1, 2, 4 and 6 compose into **replay**, which is why it is not a feature bolted on
at the end.

**No wall clock in the checks either.** Time comes from the snapshot's `observedAt`, so a
decision replayed tomorrow is judged against the facts that were true when it was made.

---

## Replay

Edit a rule in the console. It saves as a new version. Re-run the entire decision log
against it and see the diff:

> *"Across 54 recorded decisions, 8 approvals would now be refused and 0 refusals would now
> pass. 39 unchanged."*

You can also preview a change before saving it, so a finance team can see what a policy
edit would do to history before committing to it.

---

## The demo

1. **Run a task.** Card issued, scoped to exactly the PO total, expiring with the quote.
2. **Press the same button again.** No new fixture, no second agent, nothing scripted.
   Refused — by the record the first run itself wrote. Two independent rules catch it:
   the line is already fulfilled, and a card already exists for it. **The pipeline never
   reaches the ISSUE stage, so Rain is never called.**
3. **Open the provenance panel.** Four fields on the failure: the rule, what it expected,
   what it got, and the field of the record it read.
4. **Open the policy tab, change a rule, hit replay.** The diff across all history.
5. **Write your own purchase order.** Any field — vendor, SKU, a cent over the quote — and
   press issue. It posts to the same endpoint the tasks use; there is no demo-mode branch.

---

## Running it

```bash
npm install
npm run seed     # regenerate the committed history (deterministic, rarely needed)
npm test         # 78 tests over the checks, hashing, replay and concurrency
npm run dev
```

Copy `.env.local.example` to `.env.local`. Nothing is required to run locally — with no
`DATABASE_URL` the app uses an in-memory store, and with no `RAIN_API_KEY` cards are
simulated and labelled as such in the UI.

🔴 **`DATABASE_URL` must be set on the deployed build.** Vercel's serverless memory does not
survive a cold start, and the decision log is what replay reads.

---

## Layout

| Path | |
|---|---|
| `lib/types.ts` | The domain. Money is always integer cents |
| `lib/checks/` | The eleven checks and `verify()`. Pure, no I/O, no model, no clock |
| `lib/rules/` | Versioned rule data and the sha256 that gets anchored |
| `lib/replay/` | Re-judging stored decisions against another rule version |
| `lib/store/` | Append-only log. Postgres when `DATABASE_URL` is set, memory otherwise |
| `lib/pipeline.ts` | The six stages in order |
| `lib/rain/issuer.ts` | 🔴 The join seam with the Rain integration |
| `lib/seed/` | 54 committed historical decisions, deterministically generated |
| `app/api/` | `state`, `run`, `rules`, `replay`, `reset` |

Full planning notes and the reasoning behind every decision above are in [`docs/`](docs/).

## Team

Team 10 — Raingentic Commerce Hackathon NYC, August 2026.
