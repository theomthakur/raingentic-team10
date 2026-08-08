# The six design decisions

These are the game changers. Each one is a sentence you say out loud during the demo, and
each one is a reason the system is better than a script.

Make all six deliberately, early, and write them in the README.

---

## 1. Rules are versioned data, never code

A rule is a row, not an `if`. It has an id, a type, parameters, an enabled flag and a
version. Editing one creates a **new version**; the old one is never mutated.

**Why it decides things:** this is the exact gap that lost ABI. It is the difference between
"we hardcoded the policy" and "the customer owns the policy." Anyone who has shipped
business software recognises it instantly.

🗣️ *"The rules are configuration, not source code. A finance team changes them without a
deploy."*

---

## 2. ⭐ No model in the verify path, and that is what buys replay

The agent proposes. Deterministic code decides. There is no LLM anywhere in the checking
loop.

Most people hear this as a safety argument. It is also a **capability** argument, and this
is the deeper point:

**Replay only works because the checks are deterministic.** If a model made the call, you
could not meaningfully re-run history, because you would get a different answer the second
time and would not know whether the change came from your new rule or from the model's mood.
Determinism is the thing that makes the audit feature possible at all.

🗣️ *"There is no model in the decision path, which is why we can replay every past decision
against a new rule and trust the diff."*

That single sentence is the strongest thing you will say all weekend.

---

## 3. Enforcement at issuance, not at settlement

A failed check does not decline a transaction. **It never creates the instrument.** No card
exists to be declined.

**Why it decides things:** it is Rain's own principle, and three of five judges work at
Rain. Rain says controls are *"enforced at card issuance rather than applied after the
fact."* You are applying their principle one level up, to the reason rather than the amount.

🗣️ *"There is nothing to block, because nothing was created."*

---

## 4. ⭐ Store a snapshot of the record, not a pointer to it

When a decision is made, store **what the record actually said at that moment**, not just
its id.

**Why it decides things:** records change. An order gets fulfilled, a quote gets revised, a
budget gets topped up. If you store a pointer, then replaying a decision six hours later
reads today's record and produces a meaningless answer. You would not be replaying the
decision, you would be making a new one.

Storing the snapshot is what makes replay honest, and almost nobody thinks of it under time
pressure.

🗣️ *"We store what the record said at decision time, so a replay re-judges the same facts
rather than today's facts."*

---

## 5. One card per order line, keyed for idempotency

The idempotency key is the order line. Issue once. A retry returns the existing card rather
than creating a second one.

**Why it decides things:** Farhan Khwaja is a Rain engineer who builds high-throughput
transactional systems. Retries are the first thing someone like that probes, because in
payments the retry is not hypothetical, it is Tuesday. Most hackathon projects double-spend
on a refresh.

🗣️ *"The order line is the idempotency key, so a retry returns the same card instead of
issuing a second one."*

---

## 6. The decision record is append-only

Every evaluation writes one immutable row: the declared intent, the record snapshot, the
rule version, each check's result, and the outcome. Nothing is updated in place. Nothing is
deleted.

**Why it decides things:** it is what an auditor needs, and it is what makes provenance
possible on screen. A judge clicking a refusal sees the rule that failed, the value it
expected, the value it got, and the record it read. Four fields, five seconds, no questions
asked.

🗣️ *"Decisions are append-only. We can explain any transaction from six months ago without
re-deriving anything."*

---

## How they compose

Notice they are not six separate features. They lock together:

```
rules as data ─────┐
                   ├──> a decision can be re-judged
no model in path ──┘         │
                             │
record snapshot ─────────────┤
                             ├──> REPLAY is honest and meaningful
append-only log ─────────────┘
                             │
                             └──> PROVENANCE is visible per decision

enforcement at issuance ──> a failure produces no instrument
idempotency on the line ──> retries cannot double-spend
```

**Replay is not a feature you bolt on. It falls out of four decisions you make on purpose in
the first hour.** That is what a system design decision means, and it is the thing to say
when a judge asks how you built it.

---

## The order to say them in

1. Enforcement at issuance (their language, immediate credibility)
2. No model in the verify path (the thesis)
3. Rules as versioned data (the ABI lesson)
4. Therefore replay, honestly, because of the snapshot
5. Idempotency, if an engineer probes
6. Append-only, if anyone asks about audit

Do not recite all six unprompted. Land 1, 2 and 3 in the pitch. Keep 4 for the demo moment.
Hold 5 and 6 for the questions, because having a real answer ready for a hard question is
worth more than saying it first.
