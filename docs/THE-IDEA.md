# Mandate, the idea in one page

> **An agent gets a scoped virtual card that is bound to the exact purchase order it
> negotiated, vendor, SKU, price, expiry, and any deviation means no card at all.**

That is the whole pitch. Everything else in this folder is either how to build it or why it
is the right one.

---

## ⭐ Framing update: quote-bound procurement, same architecture underneath

The original framing had the agent declare a free-text "reason" that got checked. That
still works, but it is abstract. **Ground it in a concrete object instead: the accepted
quote from the negotiation stage becomes a purchase order, and the card is bound to that
PO.**

This changes naming, not engineering:

| Before | After |
|---|---|
| `{ orderId, lineId, merchant, amount, reason }` | `{ poNumber, vendor, sku, unitPrice, quantity, quoteExpiry }` |
| "the reason doesn't hold" | "the card doesn't match the accepted quote" |
| rule 4, merchant mismatch | rule 4, **vendor doesn't match the negotiated PO** |

The six checks are the same six checks. The object they check is now a real business
document a judge recognises on sight, rather than a free-text field they have to trust.
And it gives the negotiation stage (see THE-PLAN) a causal role: negotiate produces the PO,
the PO is what gets bound to the card, rather than negotiation and verification being two
separate things that happen to run in sequence.

**Ideas explicitly considered and set aside, so the team does not re-litigate them
mid-build:**

- **Delegated budget trees** sit too close to Rain's own program-level caps. Ranked below
  Mandate in IDEAS.md already.
- **Replay as the headline product** is real but weak without live issuance behind it. Keep
  it as design decision 4, shown mid-demo, not the opener.
- **Agent Underwriting** (an underwriter issues from its own collateral pool, charges a
  premium settled on Monad) needs a second Rain collateral identity the team was not issued.
  Real settlement engineering added on top of, not instead of, the core build. Rejected.
- **Burn Rate / streaming limits** (a Monad payment stream trickles into a card's limit
  live) is the best pure demo of anything considered, but it needs a Monad streaming
  contract built from scratch AND depends on Rain allowing a live card's limit to be
  updated post-issuance, which the workshop's own "retired automatically once the job is
  done" framing argues against. Two unconfirmed dependencies stacked on a single afternoon.
  Rejected.
- **Four-Eyes consensus** (LLM agents vote, votes recorded on Monad, 2/3 issues the card)
  is rejected outright, not just for time. Voting agents put a model back in the verify
  path, which is exactly what design decision 2 argues against, and it is the sentence that
  makes replay meaningful. This idea trades the strongest line in the pitch for the
  weakest architecture.

## ✅ Settled: what "Rain misses" actually means

The original pitch claimed rule 4, vendor mismatch, is something "every Rain control
passes." **That claim is false and must not be said.**

Rain supports **exact-merchant allowlists**, not only categories. Their press release
enumerates "approved merchants or payment recipients" as a dimension distinct from merchant
category codes, and their Agent Control Layer post lists agent-level controls as amounts,
merchant and category allowlists, spend intervals and card expiry. Citations in
[RAIN-API-CONFIRMED.md](RAIN-API-CONFIRMED.md).

Which means a card Mandate scopes to the confirmed vendor never had the chance to let a
different vendor through — because Mandate is the thing telling Rain which merchant to lock
to. Claiming Rain misses it would be claiming credit for using their own feature.

**What is still completely true, and is the better claim anyway:** all six of Rain's
enumerated dimensions describe the *instrument* — amount, merchant, category, frequency,
active-card count, expiry. **None describe the obligation behind it.** So five things remain
genuinely uncovered, and this is the list to say out loud:

1. which internal purchase order a spend belongs to
2. whether that order is still open
3. which specific **item** is being bought
4. whether a card was already issued for that order line
5. who must approve above a delegated threshold

**Lead the demo with #4** — a duplicate spend on an already-fulfilled line. No card
control expresses it at any granularity, because a card issuer does not know your order
system exists. It needed no validating on the day and it still doesn't.

**Vendor mismatch is now a supporting point, framed the only honest way:** *we set every
control Rain gives us, and we add the five a card control cannot express.*

## Agent Underwriting, noted as a future direction, not built this weekend

Worth one sentence in the closing if there is time: "the same reason-checking pattern is
the seed of agent liability underwriting, an underwriter issuing from its own pool based on
a risk-priced check of the intent." Said as a forward-looking idea, not a claim about what
was built. No engineering follows from this.

**Two small, zero-risk things worth stealing from them, both bolt-ons with the same cut
priority as the existing optional stages:**

- **A tiny real Monad fee per recorded decision**, from the Underwriting idea's premium
  concept, minus the second collateral pool. Applies on top of the rule-version anchor
  (THE-PLAN's primary Monad use, load-bearing), not instead of it. Charge a fraction of a
  cent per decision write. Same owner, cut before the rule-version anchor if time is short.
- **A live budget meter in the UI**, from Burn Rate's progress-bar visual, without any
  actual streaming. The remaining budget for a cost centre, updating as purchases are
  approved. Owned by B, pure UI, no new API dependency.

---

## Why this is the ultimate version, not just the safe one

**It sits on top of what Rain shipped, instead of copying it.** Rain enforces *how much*
and *where*, at card issuance. Mandate enforces *why*, at the same point, one step earlier.
Three of five judges work at Rain. Most other teams will either duplicate their control
layer or ignore it. This one extends it.

**It survives the worst-case API outcome.** If sandbox authorizations do not work, most
agentic-commerce demos lose their story. This one does not, because a failed check means no
card is ever issued. Issuance is the only thing that has to work.

**It is built from decisions, not features, which is what actually won at ABI.** Rules as
versioned data. No model in the verify path. A stored snapshot, not a pointer. An
append-only log. Four small decisions that compose into one big one, **replay**, which
cannot be faked in a five-minute demo the way a feature can.

**It legitimately covers all four submission categories from one build:**

| Track | How |
|---|---|
| Best use of Rain | card issuance is the enforcement point |
| Agents actually move money | a real scoped virtual card, real settlement |
| Agent negotiation | a small stage upstream of the intent, competing seller quotes |
| Monad bounty | each rule version hash anchored as a real testnet transaction, decisions optionally too |

Same pipeline, same two owners, same 17:00 join. Not four projects.

**Every piece answers a question a judge will actually ask, with an answer only this team
could give convincingly:**

| Likely question | The answer |
|---|---|
| Why not just use Rain's own controls? | The reason-check is one level above amount and merchant |
| How do you know the rules aren't hardcoded? | Replay: edit a rule, re-run history, show the diff |
| Why Monad and not any chain? | You have to anchor the rules for the audit claim to hold; only at Monad's cost can you afford decisions too |
| Is the negotiation real? | Built from real async multi-agent orchestration experience |

---

## The one sentence for the pitch

> *"Rain lets you bound how much an agent spends and where. Mandate checks why, and if the
> reason doesn't hold, the card is never issued."*

---

## Where the rest lives

- **[THE-PLAN.md](THE-PLAN.md)** — architecture, schedule, who owns what, cut lines
- **[DESIGN-DECISIONS.md](DESIGN-DECISIONS.md)** — the six decisions and why each one matters
- **[ABI-LESSON.md](ABI-LESSON.md)** — why more features was already tried, and lost
- **[RAIN-API.md](RAIN-API.md)** — the confirmed scoped-virtual-card flow, endpoints, questions to ask
- **[IDEAS.md](IDEAS.md)** — the other ideas considered, and why this one won
