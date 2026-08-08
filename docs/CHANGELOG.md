# Changelog

What changed, when, and why. Newest first. Times are local (EDT).

---

## 2026-08-08 · Reframed: autonomy is the product, human approval is the exception

A Rain engineer read the build and gave the sharpest note we've had: architecturally this
is fine — a normal purchase never touches a human — but the *presentation* gave the human
path so much attention that a judge could reasonably ask "isn't this supposed to be
autonomous agentic commerce?" Nothing was rebuilt. The hierarchy changed.

- **The thesis line now leads with autonomy.** Agents can already reason and negotiate and
  Rain lets them move money; the missing piece is proving the transaction is the one they
  were authorised to make.
- **Three parts, one sentence each**, on the system design page: **Rain** moves the money,
  **Mandate** verifies the intent, **Monad** proves the policy. Rain asks *can this agent
  spend this much, here?* Mandate asks *is this the exact purchase it was supposed to spend
  on?*
- **The hold is off the main path** in every diagram and document. It was drawn as a peer
  of ISSUE; it is now an explicitly-marked exception, because that is what it is.
- **The approval queue leads with the proportion:** *"48 of 54 purchases completed with no
  human involved at all."* A number answers "why are humans approving things?" better than
  an argument does, and it sits below the provenance panel now rather than above it.
- **Dual control on rule changes is demoted to an answer**, not a demo beat. It is the
  reply to "couldn't you just change the rules afterwards?", worth having ready and not
  worth demo time unless asked.
- **The demo order is rewritten**: autonomous purchase first, then the duplicate, then
  three ways of breaking it, then replay. Escalation is one closing sentence, if there is
  time.

The distinction the whole reframe turns on: not *"humans approve large purchases"* but
*"agents operate autonomously within delegated authority, and human approval is only the
escalation path outside it."* Autonomy has boundaries — the same ones an employee has.


## 2026-08-08 · One navigation, and a map of the six pages

The site had grown a page at a time and nobody had looked at the whole thing. An audit
found three real problems, one of them serious.

- 🔴 **The console had no navigation at all.** `Header.tsx` imported `SiteNav` on line 2
  and never rendered it. The page a judge lands on was a dead end — catalogue, agents,
  system design and the deck were all unreachable from the front door.
- **The workspace had a second, competing nav** of its own whose links went nowhere else
  in the site, so it was effectively a separate little app sharing a domain. It now uses
  the same bar as everything else, with its section anchors demoted to an "on this page"
  row underneath — two clear levels instead of two competing ones.
- **A failed load stranded you completely.** The loading screen showed the error and
  offered nothing else: no retry, no way out, even though every other page is static and
  would have loaded fine. It now carries a retry and the full nav.
- The brand mark now points at the console from **every** page. It used to go somewhere
  different depending on where you were, which is how people get lost.
- Nav items carry a `blurb` — "Catalogue" could be anything until you read "what an agent
  can buy".

**The system design page now answers the question directly**, with a numbered map of all
six pages built from the same `PAGES` array the nav uses, so the two can never drift. The
short version: two of the six are the product and the rest explain it. Workspace is what a
customer would use day to day; Console is the same system with its working shown. Same
data, same API, same decisions.

**Also:** the challenge panel sits at the bottom of a long page, so the console now has a
"Try to break it →" link at the top pointing straight at it. `PROJECT-DOCUMENTATION.md`
said six checks when there are eleven, omitted the hold branch entirely, and described the
Monad anchor as unwritten. All three now match the build.


## 2026-08-08 · Beat the checks — hand the judge the attack

From the Monad workshop's Split or Steal demo. Building a side game would have cost hours
and blurred the thesis: Split or Steal solves untrusted parties with incentives, and this
project's whole argument is that you don't need to trust anyone if claims are checked
against the record. But the game-theory framing was worth taking.

- **A challenge panel that invites you to break it.** A purchase order that would pass,
  eleven checks in the way, and shortcuts for the obvious attacks. A judge who tries to get
  money out and fails believes it far more than one who watches a scripted run succeed.
- **"Defeated" is a deliberately hard bar.** A refusal is the check *working*. A check only
  counts as defeated if a card is issued for an order that doesn't match the record — so
  the headline counter reads zero and stays there. The second counter, checks you've run
  into, is the one that moves.
- Every attempt goes through **the same `/api/run` path a task takes**, so there is no
  separate code for "the judge's attempt" that could behave differently.

**The structuring check had no demo path at all.** It was built and tested but nothing in
the UI could trigger it, because any deviation from a quote trips an earlier rule first. So
`PO-4424-A` and `PO-4424-B` now exist: the same conveyor order raised as two halves.

Sizing them took a second pass. At 15 units each half is $21,750, which is over
`procurement-02`'s own $20,000 authority — so the refusal cited two rules and the point
blurred. At 13 units each half is $18,850: comfortably inside that agent's authority, and
only the $37,700 running total crosses the company limit. Now the first half is **approved
with nothing against it**, and the second is held by `no-structuring` alone:

> *"On its own this is $18,850.00, under the $25,000.00 limit — but $18,850.00 has already
> gone to Bellweather Industrial…"*

Both halves are genuine accepted quotes. Nothing is forged. That is exactly the point.

- The architecture page now says why the last four checks exist: *every check assumes the
  agent is playing to win; splitting a purchase isn't a lie, it's a strategy, so they check
  the pattern rather than the move.*


## 2026-08-08 · Iteration 8 — make the deploy failure loud

The likeliest way to lose the demo, and dangerous precisely because it works perfectly on
a laptop either way.

Vercel is serverless: module memory does not survive a cold start. Deployed without
`DATABASE_URL` the decision log empties whenever the instance goes idle, so replay — the
feature that cannot be cut — has nothing to replay. It looks fine when you test it and is
empty when a judge opens the link ten minutes later.

- The app now **says so on screen**, in red, when running in production with no database.
  A quiet version of this warning is exactly how it would get missed.
- [DEPLOY.md](DEPLOY.md) has the three-minute fix and a pre-demo checklist whose real
  item is *"wait ten minutes, reload, are the decisions still there?"* — everything else
  fails loudly; this one fails by looking empty.

## 2026-08-08 · Iteration 7 — idempotency under concurrency (a real bug, found and fixed)

Fired two identical purchase requests at the same instant. **Both were approved and two
cards were issued.** Rule 6 only ever protected the sequential case: both requests took
their snapshot before either wrote a card, so both honestly read "no card yet" — they
just read it a moment too early.

This is exactly what a judge who builds high-throughput transactional systems would probe
first, and the pitch claims idempotency out loud, so the claim had to become a property.

- **The order line is now reserved before anything is created.** `claimOrderLine` is
  atomic: in Postgres a primary-key insert with `on conflict do nothing ... returning`, so
  two concurrent callers cannot both win; in memory a check-and-set with no `await`
  between the two halves, since an await there would reopen the exact window it closes.
- The losing request is **refused with a reason that says what really happened**, rather
  than the stale check that passed a moment earlier.
- A failed issuance **releases the line**, so a transient error is not a permanent lock.
- Re-verified: two simultaneous identical requests now produce **exactly one card**.
- Three concurrency tests added. 44 passing.

In payments this is not hypothetical — it is a double-click, a retried webhook, two queue
workers draining the same job.

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
