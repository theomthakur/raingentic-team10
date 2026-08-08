# Changelog

What changed, when, and why. Newest first. Times are local (EDT).

---

## 2026-08-08 · Iteration 6 — stage 7 REVOKE, the card dies

Rain's own framing is that an agent's card is *"retired automatically once the job is
done."* Every team this weekend will demo a card being born. Nobody will demo one dying.

- After settlement the card is retired, and the trace now runs the whole lifecycle:
  `NEGOTIATE → PROPOSE → VERIFY → ISSUE → SETTLE → REVOKE → RECORD`.
- It pre-empts *"what stops the agent reusing the card"* without having to argue: the
  instrument exists for exactly the duration of the obligation and not a minute longer.
- A retired card **still blocks re-issuance** (`countRevoked`), so the run-it-twice refusal
  is unaffected — the obligation was met once, and that does not become untrue.
- `DELETE /cards/{id}`, which the client used to call, returns 404. Replaced with the
  confirmed `PATCH /issuing/cards/{id}`.
- 🔴 **The accepted status value is still unknown** — `"inactive"` returns 400. It is
  isolated to `RAIN_CARD_INACTIVE_STATUS`: ask a Rain engineer, put the answer in
  `.env.local`, and real revocation starts working with no code change. Until then cards
  retire locally and the UI says *simulated* rather than claiming a revocation that did
  not happen. A card that genuinely could not be retired reports a failed stage.

## 2026-08-08 · Iteration 5 — the Monad anchor, built and inert

The last unsatisfied track. Written in full and wired to the UI; it activates the moment
`MONAD_RPC_URL` and `MONAD_PRIVATE_KEY` exist. Nothing else depends on it — a rule version
works identically unanchored, it simply carries a weaker claim.

- **`anchorRuleVersion()`** sends a zero-value transaction to the sender's own address
  with `version || sha256(rules)` as calldata. No contract to deploy and none to get
  wrong; the payload is the point, and it is a real transaction either way.
- **Why the rule version, not every decision.** Replay proves the rules are data. It does
  not prove they were not rewritten afterwards to fit a history someone already had, and
  "trust our timestamps" is no answer because the timestamps are ours. An independent
  existence proof closes that. Remove it and a specific sentence in the pitch stops being
  true — which is the test for whether the chain is structural or decorative.
- **The honest Monad argument:** you *have* to anchor the versions or the audit claim
  collapses, and that is a handful of writes. You also *want* every decision, and there
  are thousands. At 50 cents a write you would anchor the rules and give up the decisions.
  Only somewhere this cheap lets you afford both.
- Only **active** versions can be anchored — publishing a pending one would assert that a
  policy exists when nobody has approved it.
- Verified inert without credentials: `anchoringEnabled: false`, a clear 501, and the rest
  of the app entirely unaffected.

**To switch it on:** a Monad testnet RPC URL and a funded testnet key in `.env.local`.

## 2026-08-08 · Iteration 4 — dual control on policy changes

Closes the sharpest criticism of replay: *"you can edit the rules, so the audit proves
nothing."* Whoever can raise a threshold could otherwise approve anything.

- **A new version is written as `pending` and decides nothing** until someone other than
  its author activates it. Segregation of duties, the same control that stops the person
  raising an invoice from also paying it.
- **The author cannot approve their own change**, and case and padding are not a way
  around it. Enforced in `activateRuleSet`, not in the UI, so a direct API call cannot
  walk around it either.
- `latestRuleSet()` returns the highest **active** version everywhere — store, API and UI.
  Verified: while v2 sat pending, purchases still ran under v1; the moment a second person
  activated it, they ran under v2.
- One pending change at a time. Two competing drafts would make "which policy is next"
  ambiguous, and the point of this is that the answer never is.
- **Previewing a change stays ungated** — seeing what an edit would do to history is
  exactly what an approver needs before deciding, so gating it behind approval would be
  backwards.
- Version history shows proposer, approver and pending state. 41 tests passing.

Working on branch `iterations` from here; merge to `main` at the end.

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
