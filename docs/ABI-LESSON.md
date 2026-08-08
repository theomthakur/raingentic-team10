# The ABI lesson, and what "beast" actually means

Read this before deciding to build more.

---

## What happened at Pulse Foundry × ABI Frameworks, 2026-06-28

**You built more than the winners did. You lost anyway.**

What WoundScope actually had:

- Resilient ingestion through an API that failed 30% of the time. Retry with backoff plus
  completeness backfill. **Zero records dropped across ~1,720 calls.**
- **Reverse-engineered four real clinical note formats and two assessment formats**, because
  the format in the documentation did not exist in the real data.
- Multi-wound separation using union-find clustering.
- Confidence-gated routing: auto-accept, flag for review, reject.
- **Per-field evidence and provenance.**
- HIPAA and PHI masking.
- Four people's branches merged into one working system.

That is a genuinely hard build. Most of it is still interview-defensible a month later.

**What the winning team had:**

- A **biller-editable Rules Config**
- A **configurable Rule Engine** reading from it
- A **Rules Version**, audited
- A dashboard toggle to **re-run instantly** against a new version
- **Validation named as its own stage** in their diagram
- An explicit **"production scale, out of scope today"** lane
- **One clean, numbered, colour-coded architecture diagram**

You had roughly 85% of their substance. They had legibility, and one product insight:
**the business rules were an input, not source code.**

---

## 🔴 So "build a beast" is the trap you already fell into

The instinct to out-build the room is the exact instinct that lost ABI. Adding a seventh
check, a fifth agent or a cleverer parser buys nothing, because nobody in the room will
read the code. They watch a four-minute demo and ask two questions.

**More engineering is not the lever. It has already been tested, and it lost.**

---

## What beast mode actually means here

Point the ambition at the axes that scored, not at feature count.

### 1. ⭐ Rule versioning and replay, the headline

This is the "re-run instantly" toggle that beat you, built properly.

Every intent the system has ever evaluated is stored: the declaration, the record it was
checked against, the rule version, and the outcome. So you can:

- Edit a rule in the UI
- It saves as **a new version**, the old one is never mutated
- **Replay every past intent against the new version**
- Show a diff: *"3 purchases that were approved would now be refused. 1 refusal would now
  pass."*

**Why this is the win condition.** It proves the rules are data rather than code, in a way
that cannot be faked. It shows you understand that policies change and history must stay
explicable. And it is genuinely cheap: the checks are pure functions over stored records,
so replay is a loop, not a rebuild.

Nobody else at this hackathon will have this.

### 2. Provenance per decision, but legible this time

WoundScope had per-field evidence and provenance and got nothing for it, because it was
buried in the code rather than shown on the screen.

This time, every refusal shows **the rule that failed, the value it expected, the value it
got, and the record it read.** Four fields. Visible. A judge can audit one decision in five
seconds without asking you a question.

Same engineering you already did. Legible this time.

### 3. Name the stages out loud

`Task → Propose → Verify → Issue → Settle → Record`, in the diagram, numbered, colour-coded,
shown in the first thirty seconds. The winners named validation as its own stage and it read
as senior. You did the same work and called it nothing.

### 4. The out-of-scope lane

Draw it. Queue workers, webhook ingestion, warehouse for the audit log, idempotency keys,
per-tenant rule versions. It pre-answers "how would you scale this" and it is honest about
hackathon scope, which reads better than pretending.

### 5. Vocabulary

Say **idempotent**, **source of truth**, **audit log**, **rule version**, **enforced at
issuance**, **provenance**. Precise words signal seniority to engineers. Three of the five
judges are engineers at a payments company.

---

## The one-sentence version

**At ABI you had the better system and the worse story. Build the same quality of system,
and this time spend the last three hours on the story.**

Twice the workforce should buy you a rehearsed demo, a replay feature and a real diagram.
Not seven more checks.
