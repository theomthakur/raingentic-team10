# Changelog

What changed, when, and why. Newest first. Times are local (EDT).

---

## 2026-08-08 · Iteration 3 — human oversight, and controls that cite their source

Answers the first objection anyone raises: *"no human is in the loop, why would I trust
it?"* Reasoning and citations in [CONTROLS.md](CONTROLS.md).

- **Every rule now names the real-world control it implements.** None were invented here —
  rules 1–4 are a three-way match, rule 6 is an idempotency key, rule 7 is a delegation of
  authority. That is most of the trust argument: these are the controls a finance team
  already runs, moved to before the money is committed.
- **Rule 7, delegated authority.** Above $25,000 a purchase is **held**, not refused —
  every check passed, it is simply large. A third outcome, because a purchase that is
  *wrong* and one that is merely *large* need different answers; collapsing them either
  blocks legitimate spending or waves through the thing you most wanted a person to see.
- **No card exists while a purchase waits.** Approving is what creates the instrument, so
  a rejected escalation has nothing to claw back.
- **Approval inbox**, requiring a named approver — an unattributed approval is not an
  approval, since the point of the control is that someone accepted responsibility.
- **The release re-runs every check** against a fresh snapshot. The world may have moved
  while the purchase sat in the queue. Approval is permission to proceed, not a promise
  that the facts still hold.
- **The hold and the release are two rows**, never a mutation, so the log shows both that
  a person was asked and that a named person answered.
- Two approvers releasing the same purchase: the second is refused. Rule 6 would catch it
  anyway by reading what the first release wrote — idempotency protecting a human race,
  not just a machine retry.

**Bug caught by the tests:** replay classified `held` decisions as refused, because it
only knew two outcomes. It now classifies exactly as the pipeline does and buckets changes
by direction, so three outcomes still sort into stricter and looser. 37 tests passing.

## 2026-08-08 · Iteration 2 — the replay diff explains itself

The diff was a plain list of POs, which named what flipped but never why.

- Every flipped rule now carries **both sides** of the comparison, so a row reads
  *"was: expected $8,466.00 ± $169.32, passed · now: expected ± $0.00, got $8,596.22"*.
  Naming the rule alone required taking the diff on trust.
- **The policy change is shown first**, as `toleranceBps 200 → 0`, because it is what
  causes every number below it.
- Headline counters as stat tiles, and any row is clickable through to that decision's full
  provenance.
- Three tests over the rule diff; 32 passing.

## 2026-08-08 · Rain API confirmed against the live sandbox

**Every open question in `RAIN-API.md` is now answered.** Full detail in
[RAIN-API-CONFIRMED.md](RAIN-API-CONFIRMED.md).

- **Auth header is `api-key`**, not `Authorization: Bearer`. Fixed in `lib/rain-client.ts`.
  The API named the header in its own 401, so this is confirmed rather than guessed.
- **The API lives under `/issuing`.** Card creation is
  `POST /issuing/users/{userId}/cards`, not `/cards` or `/issuing/cards`.
- **KYC is approved and active**, but `contracts: []` — no collateral is linked to the
  user, so an issued card has no spending power. Open question for a Rain engineer.
- A card was **created unintentionally** while mapping the API: the endpoint returned 200
  for a one-field body where a validation error was expected. It is active, unscoped, and
  expires 2032. No collateral, no real money. Deactivation is blocked on an unknown status
  enum — also an open question.
- Consolidated eleven throwaway probe scripts into one read-only
  `scripts/rain-explore.ts` (`status` | `cards` | `map`).

**Open, ask on site:** the `configuration` schema for spending limits and expiry; the card
status enum for deactivation; whether the collateral contract needs attaching or funding.

## 2026-08-08 · Iteration 1 — the negotiation is visible

The negotiation stage was fully built and completely invisible: it only ran through
`/api/purchase`, and the console never showed it, so an entire submission track had no
demo.

- Negotiated tasks now sit above the direct ones in the console and run the real
  negotiation. `NEGOTIATE` is a stage in the trace.
- New `NegotiationPanel`: each seller's opening price paired with where it landed after the
  counter round, so the strategies read as strategies. The aggressive discounter concedes
  9% and still loses to the firm seller who barely moves, because it started lower.
- The negotiation summary is **stored on the decision**, so any past negotiated purchase
  can be reopened to see how its price was arrived at. Recorded, never checked — the rules
  read the record, not the seller's reasoning.
- Provenance panel lands on the newest decision instead of empty; the hand-written PO form
  prefills from a passing order so a judge has to actively break it.

## 2026-08-08 · Submission documentation

- `SUBMISSION.md` (+ PDF): plain-language explanation mapped to all four categories, with
  an honest per-track status — built / built-but-simulated / not yet written.
- Corrected drift in `PROJECT-DOCUMENTATION.md`, which pointed at `lib/verify.ts` and
  `lib/db.ts` (neither exists) and claimed real settlement and a finished Monad anchor.
- `scripts/md-to-pdf.sh` renders markdown through pandoc and headless Chrome.

## 2026-08-08 · Fixture fix — one refusal, one reason

`PO-4421` was charged to `CC-FAC`, which had $880 left against a $1,992 purchase, so a task
built to demonstrate **vendor mismatch** was failing on two rules at once and the point
blurred. Cost centres a demo task touches now carry clear headroom; `CC-MKT`, which no task
uses, carries the near-limit budget that drives the amber meter.

## 2026-08-08 · Plan A and Plan B joined

- A's negotiation runs upstream of PROPOSE; its winning quote is written to the record as
  an accepted order line, so the declared PO is checked against something independent
  rather than against itself.
- `lib/rain/issuer.ts` calls A's `issueScopedCard`; the verify stub is gone. Rain is
  reached only on the pass branch, enforced by the shape of `runPipeline`.
- **PO numbers are derived from the task, not a fresh uuid.** Running the same task twice
  is the same order line, which is what rule 6 exists to catch; a random id per run would
  have silently defeated it.

## 2026-08-08 · Plan B — the decision layer

- Six checks as pure functions: no I/O, no model, **no wall clock** (time comes from the
  record snapshot, so a replay judges the facts that were true then).
- Rules as versioned data with a sha256 per version, ready for the Monad anchor.
- Append-only decision log storing a snapshot of the record rather than a pointer.
- Storage picks Postgres when `DATABASE_URL` is set, memory otherwise; 47 deterministically
  generated decisions ship as committed JSON so replay has real history after a cold start.
- Replay, provenance panel, rule editor, budget meters, hand-written PO form.
- 29 tests over the checks, hashing and replay.
