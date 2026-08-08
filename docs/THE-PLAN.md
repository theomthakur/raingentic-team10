# Team 10, the plan

> 🔴 **Read [ABI-LESSON.md](ABI-LESSON.md) first.** At the ABI hackathon you built ~85% of
> the winning system's substance and lost on legibility. More engineering is not the lever.
> It has already been tested, and it lost. "Beast mode" here means **rule versioning,
> replay, visible provenance and a rehearsed demo**, not seven more checks.

**Decision: all in on Raingentic. Checkout is cancelled.**

That buys back Sunday morning, removes the shuttle, and means the demo gets rehearsed
instead of rushed. It also means there is no fallback, so the scope below is deliberately
small enough to finish.

📮 **Tell the Checkout organisers you are not coming.** They have limited capacity and said
they may turn people away at the door. Someone else can have the spot.

---

## The build

**Intent-bound spending.** Working name: **Mandate**. In payments a mandate is a standing
authorization to act on someone's behalf, and it also means the reason you were sent. Both
readings are the product.

### The one-line pitch

> Rain lets you bound **how much** an agent spends and **where**. Mandate checks **why**,
> and if the reason does not hold, the card is never issued.

### The argument

An agent with a card limited to $200 at office-supply merchants can buy entirely the wrong
thing, at an allowed price, from an allowed merchant, for a reason it invented. Every
control passes. The purchase is still wrong.

Rain's own framing is that controls are *"enforced at card issuance rather than applied
after the fact."* Mandate takes that one level up. The agent must declare its reason
**before** an instrument exists, and deterministic code checks that declaration against the
system of record. A failure does not produce a declined transaction. It produces **no card
at all**. There is nothing to block, because nothing was created.

---

## 🎯 One build, all three tracks

The tracks are not mutually exclusive. Rain's "Best use of Rain" and the general track
("agents actually move money, use Rain, Monad or any other relevant infrastructure") are
almost certainly scored from the same submission pool with different framing. Building
three separate things to chase three prizes is the beast-mode mistake again. **One build,
three genuine reasons it qualifies for each.**

| Track | How Mandate already qualifies | What it needs |
|---|---|---|
| **Best use of Rain** | Card issuance is the enforcement point, exactly Rain's own architecture | nothing extra, this is the core build |
| **General, "agents move money"** | Real money moves through a real scoped virtual card | nothing extra, same reason |
| **Agent negotiation** | Nothing yet | ⭐ a real, small negotiation stage, see below |
| **Monad bounty** | Nothing yet | ⭐ one genuine on-chain step, see below |

### The negotiation piece, owned by A, upstream of everything else

Om has a real background in this specifically: a multi-agent negotiation orchestrator built
on raw asyncio (DealForge). The **rules say all code is written fresh today, so it is not
reused**, but the pattern and the judgement of how to build it well transfer directly, which
is exactly the kind of depth that survives a judge's follow-up question.

**Keep it small.** Not a long haggling protocol. Before the buyer agent declares its intent
in stage 2, it gets competing quotes from **two or three seller agents** and runs **one
counter-offer round**. The winning quote becomes the declared intent that stage 3 then
verifies. This is genuinely A2A negotiation, it is upstream of the existing pipeline rather
than beside it, and it makes for a better demo: two agents visibly haggling, a winner, then
that winner's number gets checked before any money moves.

**Owner: A.** It is a small extension of "the agent that decides to spend," not a third
workstream, so it does not need a third person or a schedule change.

**Cut line: second thing cut, right after the Monad anchor, before touching verify or
issue.** If it does not fit, the pipeline still works exactly as planned, one seller quote
instead of a negotiated one.

### The Monad piece, and why it is not a bolt-on

⭐ **Updated: anchor the rule version, not the decision. This is the structural one, not the
decorative one, and CONTEXT.md is the authority on this.**

Replay proves the rules are versioned data. It does not prove the rules were not edited
*after* a batch of decisions to fit history you already had. In a system whose whole claim
is auditability, "trust our timestamps" is the weak link, and the append-only log does not
fix it, because the log is also yours to have written.

**So when a rule version is created, write a hash of that version to Monad.** Now the rule
set has an independent timestamp, and every decision that references version 1 is provably
judged against rules that existed before it. This is load-bearing, remove it and a specific
claim in the pitch breaks, unlike a per-decision anchor which is nice-to-have.

It is also cheaper: one transaction per rule version, not one per decision, same code path
(hash, send, store the tx hash), built once and pointed at both if there is time for both.

This satisfies the Monad bounty's own stated bar better than a token gesture would:

- **"Real transactions on Monad, mocked chain calls don't count."** A hash write is a real
  transaction.
- **"The chain has to matter, would it break at 15 second finality or 50 cents a
  transaction?"** This is the honest answer, and it is sharper for rule versions than
  decisions: **you have to anchor the rules, full stop, for the audit claim to hold, and at
  Monad's cost you can afford to anchor decisions too. On a slower or costlier chain you'd
  anchor the rules and give up on the decisions.** That is
  the actual argument for Monad over a slower or costlier chain, said honestly rather than
  performed.
- It is additive to a decision you already made, not a new workstream. The append-only log
  was already the plan. This gives it a second, stronger place to live.

**Scope it as optional and late.** It hangs off the RECORD stage, after ISSUE and SETTLE
already work. If A finishes the card flow with time to spare in the 17:00-18:00 window, this
is the first thing to add. If not, it is the first thing cut, and nothing else in the plan
depends on it.

---

## Architecture

Six named stages. This is the diagram, drawn once, shown early, and it is the pitch.

```
  1 TASK        agent is given a job
       |
  1b NEGOTIATE   (optional) buyer agent gets competing quotes from 2-3 seller
       |          agents, one counter-offer round, winning quote proceeds
       v
  2 PROPOSE     agent proposes a purchase AND declares a structured intent
       |          { orderId, lineId, merchant, amount, reason }
       v
  3 VERIFY      deterministic checks against the record        <-- no model here
       |          rules are versioned CONFIG, not code
       |
    pass|fail
       |    \
       |     \--> 4b REFUSE   no card. reason returned in plain English. logged.
       v
  4 ISSUE       Rain issues a single-use card
       |          limit = exactly the approved amount
       |          short expiry, merchant scoped if supported
       v
  5 SETTLE      the purchase happens on that card
       v
  6 RECORD      intent + checks + rule version + card + outcome, stored together
                 (+MONAD)  a hash of this record, written as a real testnet tx
```

**Everything below the dotted line is out of scope today, and the diagram says so:**

```
  - - - - - - - - - - PRODUCTION SCALE, NOT TODAY - - - - - - - - - -
  webhook ingestion of authorizations  |  queue workers for issuance
  audit log to a warehouse             |  per-tenant rule versioning
  idempotency keys on every write      |  rule simulation against history
```

That lane pre-answers "how would you scale this," which is the question that will come.

---

## ⭐ The headline feature: rule versioning and replay

This is the thing that wins, and it is the ABI lesson applied directly.

Every intent the system evaluates is **stored**: the declaration, the record it was checked
against, **the rule version used**, and the outcome.

Which means you can:

1. Edit a rule in the UI
2. It saves as **a new version**. The old one is never mutated.
3. **Replay every past intent against the new version**
4. Show the diff: *"3 purchases that were approved would now be refused. 1 refusal would
   now pass."*

**Why this is the win condition.** It proves the rules are genuinely data and not code, in a
way that cannot be faked. It shows you understand that policy changes and history still has
to be explicable. And it is cheap, because the checks are pure functions over stored
records, so replay is a loop rather than a rebuild.

The team that beat you at ABI had a "re-run instantly" toggle. This is that, done properly.

### Provenance, visible this time

WoundScope had per-field evidence and provenance and scored nothing for it, because it lived
in the code instead of on the screen.

Every refusal shows four things: **the rule that failed, the value it expected, the value it
got, and the record it read.** A judge can audit one decision in five seconds without asking
you anything.

---

## The checks

Six rules. **They live as versioned configuration data, not as code.** That was the
decisive gap in the WoundScope loss, and it is the difference between a product and a
script.

| # | Rule | Catches |
|---|---|---|
| 1 | **Order exists** | An agent inventing a justification outright |
| 2 | **Order still open** | Paying twice for something already fulfilled |
| 3 | **Amount matches the quote**, within tolerance | Right vendor, wrong price |
| 4 | **Merchant matches the quote** | Right price, wrong vendor. 🔴 ~~Every Rain control passes this one.~~ **False — Rain supports exact-merchant allowlists.** See [RAIN-API-CONFIRMED.md](RAIN-API-CONFIRMED.md). The SKU half of this check is the uncovered part. |
| 5 | **Within the remaining budget** for the cost centre | Death by a thousand small correct purchases |
| 6 | **No card already issued for this line** | ⭐ Duplicate spend on retry. This is idempotency, and one judge builds high-throughput transactional systems for a living. |

Rules 4 and 6 are the two to lead with in the demo. Rule 4 is the one Rain's layer
structurally cannot catch. Rule 6 is the one an engineer will respect.

Each rule returns pass or fail **plus a sentence a person can act on**. Not "validation
failed."

---

## Who does what

**The rule: neither of you waits on the same unknown.** The unknown is Rain's API.

| | **A, the money path** | **B, the decision layer** |
|---|---|---|
| Owns | Rain auth, card issuance, collateral, the spending agent | The six checks, fixture data, **rule versioning + replay**, UI, diagram, pitch |
| Blocked by Rain? | Yes | **No. Can start in minute one.** |

The checks are pure functions over fixtures and need zero API calls. If Rain turns out
painful, B has still built the thing that wins the argument.

**Agree one function signature in the first thirty minutes**, something like
`verify(intent, record, rules) -> { ok, failures[] }`, then split and do not renegotiate it.

---

## Schedule

### Saturday, build window 13:00 to 21:00

| Time | A | B |
|---|---|---|
| **now to 13:00** | Corner a Rain engineer with the five questions in `RAIN-API.md`. **Ask about simulated authorizations first.** | Draw the diagram. Agree the interface. Write the fixture data. |
| **13:00-15:00** | Get **one** successful authenticated call. Nothing else matters until that works. | The six checks plus their tests. No UI yet. |
| **15:00-17:00** | Issue a card with a limit, end to end | UI around the checks, driven by fake results |
| **17:00** | 🔴 **JOIN.** A real check result decides whether a real card is issued. | |
| **17:00-18:00** | Both on the join. If it is not working by 18:00, **cut scope**, do not push the join later. | |
| **18:00-20:00** | The demo path. Make the refusal beautiful. Write the README. | |
| **20:00-21:00** | Deploy. Rehearse the pitch twice, out loud, timed. | |

### Sunday, 09:00 to 12:00

| Time | |
|---|---|
| 09:00-10:00 | Fix whatever broke overnight. Nothing new. |
| 10:00-11:00 | ⭐ **Replay.** Edit a rule, new version, re-run history, show the diff. |
| 11:00-11:15 | Final README, architecture image, deployed link verified from a phone |
| **11:15** | 🔴 **SUBMIT as soon as it is ready, not at the buffer line.** Pitching order
follows submission order, so submitting earlier is a strictly better position, not just a
safety margin. |
| 12:00 | Submissions close |
| 12:00-15:00 | Judging. Rehearse. Eat. |
| **15:15** | Demos and prizes ⚠️ *confirm 3:15 vs 16:00 with an organiser today* |

**The 11:30 submit is not negotiable.** Every hackathon has a team that misses the deadline
polishing.

---

## The demo, four minutes

Do not narrate the architecture. Show the thing, then explain it.

1. **Four procurement agents running.** Real tasks, real purchases. Money visibly moving.
2. **Three go through.** Cards issued, limits scoped to each purchase, collateral drawn.
3. **The fourth is stopped.** 🔴 **Superseded — do not run the demo this way.** This step
   claimed a vendor mismatch means "every Rain control passes." **That is false:** Rain
   supports exact-merchant allowlists, confirmed from public sources in
   [RAIN-API-CONFIRMED.md](RAIN-API-CONFIRMED.md). Lead instead with the run-it-twice
   duplicate refusal, which no card control can express at any granularity. The current
   demo order lives in [SUBMISSION.md §4](SUBMISSION.md).
4. **Show the reason**, in the plain sentence the checker produced.
5. **Show the provenance.** Click the refusal. The failed rule, the expected value, the
   actual value, the record it read. Four fields.
6. ⭐ **Open the rule config. Edit rule 4. It saves as version 2.** Hit replay.
   *"Across everything we've processed, three approvals would now be refused and one refusal
   would now pass."* Revert to version 1.
7. **One line to close:** *"Rain enforces this at card issuance rather than after the fact.
   We put the reason at that same point, and we can prove what any change to the rules
   would have done."*

**Step 6 is the one that wins.** It proves the rules are data rather than hardcoded, it is
exactly what beat you at ABI, and nobody else in this room will have it.

---

## The 60-second pitch

- Rain gives an agent a card with a limit and an allowlist. That bounds **how much** and
  **where**.
- Nothing bounds **why**. An agent can buy the wrong thing at the right price from an
  allowed merchant, and every control passes.
- So we made the agent declare its reason before it can spend, and we check that reason
  against the actual record. Six rules, all configurable.
- If it does not hold, **no card is issued.** Not a decline. There is nothing to decline,
  because the instrument never existed.
- Which is Rain's own principle, enforcement at issuance, applied one level up.

---

## 🔴 Rules of engagement, confirmed on the slides today

- **"Start fresh."** All project code must be written today. No existing personal projects.
  Standard libraries are fine. This does not change anything, the plan was always a fresh
  build, but it rules out reusing any prior scaffold as-is. Copy the pattern, not the repo.
- **"Ship live deployments."** A working, accessible demo link is required. **Locally hosted
  projects are disqualified outright.**
- **"Public repositories."** Code lives in a **public** GitHub repo. Not "judges added,"
  actually public. This raises the API key requirement from careful to critical, see below.
- **"Pitching order is determined by submission order."** 🔴 This changes the Sunday
  schedule. Submitting at 11:30 instead of earlier means presenting near the end, which is
  worse for attention and worse if you are trying to leave time to fix something the judges
  flag. **Submit the moment it is genuinely ready, not at the buffer line.**

## Submission checklist

- [ ] **Every team member signed up individually** on the Encode programme page. Stated as a
      requirement.
- [ ] Project created on the Encode platform
- [ ] **Repo is actually public.** Confirmed today, not "judges added."
- [ ] 🔴 **`git ls-files | grep -i env` returns only the `.example`, checked before the repo
      goes public, not after.** A public repo with a leaked key is a live incident, not a
      cleanup task.
- [ ] Deployed URL loads from a phone on cellular, not just your laptop
- [ ] README: what it does, how to run it, the architecture image, the six rules
- [ ] Architecture diagram visible without scrolling
- [ ] Both team members credited
- [ ] **Submitted by 11:30 Sunday**

---

## Cut lines, in order

If time goes, drop in this order and do not agonise:

1. **The negotiation stage is the first thing cut**, ahead of Monad. Two seller agents you
   wrote, haggling to a number you chose, is the most fakeable thing on screen, and it is
   in front of the judge whose actual job is agent orchestration. If it survives, describe
   it honestly as a quote-selection stage, not a negotiation. One seller quote replaces the
   competing quotes, everything downstream is unaffected.
2. **The per-decision Monad anchor is the second thing cut, but the rule-version anchor
   stays if at all possible.** The rule-version anchor is structural, see above; the
   per-decision one is additive on top of it.
3. Four agents becomes two
4. Real settlement becomes issuance only, and the demo is about the card that was never
   created
5. The rule-editing UI becomes a JSON file you edit and reload, **but replay stays**
6. Rules 5 and 6 drop, keeping 1 through 4

**Never cut:** the refusal case, **replay**, the architecture diagram, the deployed link, or
the submission.

Replay is the differentiator. If it comes down to replay or a fourth agent, keep replay.

---

## Two things to confirm today

- [ ] **Can you simulate an authorization** against a card you issued? Ask first, it shapes
      the demo.
- [ ] **Demo time tomorrow**, 3:15 or 16:00. The Luma page and the email disagree.
