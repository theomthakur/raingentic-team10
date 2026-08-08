# Ideas for Raingentic, Team 10 (two people)

Two builders. Ranked, with a split that keeps both of you unblocked.

All three tracks reward the same core thing: **an agent that actually moves money**. The
differentiator is what you put around the money movement.

---

## 🔴 The rule that decides whether two people is faster than one

**Never let both of you wait on the same unknown.**

The unknown here is Rain's API: the base URL, the auth header, whether you can simulate an
authorization. That could resolve in twenty minutes or eat two hours.

So split along that line:

| | Owns | Blocked by Rain? |
|---|---|---|
| **A, the money path** | Rain auth, card issuance, collateral, the agent that decides to spend | yes |
| **B, the decision layer** | The verification functions, the fixture data, the UI, the diagram, the pitch | **no** |

**B can start writing code in minute one**, because the checks are pure functions over
fixture data and do not need a single API call. If Rain turns out to be painful, B has still
built the thing that wins the argument. If Rain is easy, A joins B by mid-afternoon.

Agree the interface between you in the first thirty minutes, one function signature, then go.

---

## ⭐ 1. Intent-bound spending

**The agent has to say why before it can pay, and the reason gets checked.**

Rain's Agent Control Layer already bounds **how much** and **where**. Nothing checks
**why**. An agent with a $200 office-supply card can buy entirely the wrong thing, at an
allowed price, from an allowed merchant, for a reason it invented. Every control passes and
the purchase is still wrong.

So: before spending, the agent declares a structured intent. *Buying X, for order Z,
because Y.* Deterministic code checks that declaration against the record. Does order Z
exist? Is it unfulfilled? Does the amount match the quote? Is this merchant the one on the
quote? If any of it fails, **the card is never issued**.

**Why it wins:** it sits one level above what Rain enforces rather than duplicating it, and
it uses their controls instead of replacing them. Rain says controls are "enforced at card
issuance." Card issuance is exactly the call you have credentials for. A failed check does
not produce a declined transaction, it produces **no instrument at all**.

**The split**
- **A:** Rain integration. Issue a single-use card scoped to exactly the approved amount,
  short expiry. Build the agent that reads a task and proposes purchases.
- **B:** The checker. Pure functions, one per rule, each returning pass or fail plus a
  human-readable reason. The rule set is **configurable data, not code**. Plus the UI that
  shows a purchase being approved and one being refused.

**Demo:** two purchases side by side. One issues a card and money moves. One is stopped,
with the reason in plain English.

---

## ⭐ 2. Budget delegation tree

**A parent agent hands sub-budgets to child agents, each narrower, all enforced at
issuance.**

A procurement agent gets $5,000. It spawns a travel agent with $800 and a supplies agent
with $300. No child exceeds its slice, no child can raise its own limit, and the parent
cannot exceed its cap by spawning more children.

**Why it wins:** maps directly onto Rain's program-level caps, and the invariant (the sum of
children can never exceed the parent, at any depth) is a real testable property rather than
a UI rule. With two people the tree can actually be a tree rather than one level.

**The split**
- **A:** Rain. A real card per agent, real limits, real collateral draw.
- **B:** The budget algebra and the visualisation. The tree on screen with money flowing
  down it is the demo.

**Demo:** very strong. Live tree, money moving, one child refused mid-demo when it tries to
overspend.

---

## 3. Agent-to-agent escrow with a deterministic release condition

Two agents transact. Funds held until a condition verifies in code, not until a model
decides it is satisfied. Delivery confirmed, file hash matches, endpoint returned 200.

**Now viable with two people**, one agent each, which is what made this too big for one.

**The split:** A builds the buyer agent and escrow funding, B builds the seller agent and
the condition engine. You will need to agree the escrow state machine early, and that is the
risky coupling.

**Risk:** escrow has been built at these events before. It needs a sharp condition to feel
new, so make the release condition something a model genuinely cannot be trusted to judge.

---

## 4. Procurement agent with a human escalation threshold

Agent buys autonomously below a policy line. Above it, it stops and asks a person, with the
full reasoning attached.

**Why it fits:** the highest "commerce realism" score here. Every business deploying a
spending agent needs exactly this.
**With two people:** A does the money and the agent, B does the approval inbox, which is
where the product actually lives.
**Risk:** reads as a simple `if amount > x` unless the interesting part is what the human
sees and how the decision comes back.

---

## 5. Spend reconciliation after the fact

Agent spends, receipt returns, code checks the receipt against what was authorised.

**Only if time collapses.** Rain's own positioning is that controls are "enforced at
issuance rather than applied after the fact," so building the after-the-fact version argues
against their thesis in front of them.

---

## ❌ Do not build

- **Pay-per-use API metering.** Done at every x402 event. Baseline, not a winner.
- **A general agent payment SDK.** OmniAgentPay won first place at Arc with exactly that.
  You would be compared to it directly and lose on polish.
- **A game or spectacle play.** World of Geneva won SF with one, but it is a coin flip and
  it is not what Rain is hiring for.

---

## A two-person schedule for today

Build time is 13:00 to about 21:00.

| Time | A, money path | B, decision layer |
|---|---|---|
| **before 13:00** | Corner a Rain engineer with the five questions in `RAIN-API.md` | Draw the architecture diagram. Agree the interface with A. |
| **13:00-15:00** | Get **one** successful authenticated call. Nothing else matters yet. | Write the checks and their tests against fixtures. No UI yet. |
| **15:00-17:00** | Issue a card with a limit, end to end | Build the UI around the checks, using fake results |
| **17:00-18:00** | 🔴 **Join the two halves.** Real check result decides whether a real card gets issued. |
| **18:00-20:00** | Both: the demo path. Make the refusal case beautiful. Write the README. |
| **20:00-21:00** | Deploy. Dry-run the pitch twice, out loud, timed. |

**The 17:00 join is the moment the project either exists or does not.** If you are not
joined by 18:00, cut scope rather than pushing the join later.

---

## Whatever you pick

- **The rules are configurable data, never hardcoded.** That was the decisive gap in the
  WoundScope loss.
- **One numbered architecture diagram, shown early.** At a system-design-judged event the
  diagram is the pitch.
- **Money must actually move through Rain.** A verification layer with no transaction is the
  wrong event.
- **Show a refusal, not just a success.** Everyone demos a happy path. The moment your
  system stops a bad transaction and explains why is what people remember.
- **Name the Agent Control Layer out loud.** It shows you read what they shipped in June.
- **Draw a "production scale, out of scope today" lane** on the diagram. It answers the
  scaling question before it is asked.

---

## Using the room today

**Ask a Rain engineer:**
- What does the Agent Control Layer not cover yet, that you wish it did?
- What is the most common way teams misuse the API this weekend?
- Can we simulate an authorization against a card we issued? **Ask this first.**

**Ask other builders what they are building**, early. Twelve teams converging on pay-per-use
metering is real, and knowing that at 2pm is worth more than at the demo.
