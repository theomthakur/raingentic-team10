# Mandate, full documentation

Team 10, Raingentic Commerce Hackathon NYC, 2026-08-08/09.

---

## 1. What it is

An agent gets a **scoped virtual Rain card** bound to the exact purchase order it
negotiated: vendor, SKU, price, quantity, expiry. Deterministic code checks the declared
order against the real record before the card is ever created. Any mismatch means no card,
not a decline, an instrument that never comes into existence.

Rain's own products bound *how much* an agent spends and *where*. Mandate binds *why*, at
the same moment, one step earlier.

---

## 2. The architecture

```
  1 TASK        agent is given a job
       |
  1b QUOTE      buyer gets a vendor quote (competing quotes if time allows)
       v
  2 PROPOSE     agent declares the accepted PO
       |          { poNumber, vendor, sku, unitPrice, quantity, quoteExpiry }
       v
  3 VERIFY      deterministic checks against the record        <-- no model here
       |          rules are versioned CONFIG, not code
       |
    pass|fail
       |    \
       |     \--> REFUSE   no card. plain-English reason. logged.
       v
  4 ISSUE       Rain issues a scoped virtual card, bound to exactly this PO
       v
  5 SETTLE      the purchase happens on that card
       v
  6 RECORD      PO + checks + rule version + card + outcome, append-only
       |
  7 REVOKE      card deactivated once the job is done (if the endpoint supports it)
```

**Monad:** each **rule version** is hashed and anchored on testnet. This is what proves the
rules were not edited after the fact to fit a history someone already had, closing the one
real hole in an otherwise-airtight audit story.

Six deterministic checks decide stage 3: the PO exists and is accepted, it's still open,
the amount matches the quote, the merchant matches the quote, it's within budget, and no
card has already been issued for this exact PO (idempotency, the check that carries the
demo).

---

## 3. Why this company, specifically

Rain is not a generic payments API. It is a **Visa and Mastercard Principal Member**,
meaning it issues cards directly rather than reselling someone else's licence, live across
175 million merchant locations in 220+ countries, backing 100+ programs on $250M raised.
Its newest product, shipped this June, is the **Agent Control Layer**: programmatic
guardrails, amount limits, merchant allowlists, spend intervals, enforced *"at card
issuance and transfer initiation rather than applied after the fact."*

That last phrase is Mandate's whole thesis. Rain already committed, publicly, to
enforcement-before-the-fact as the right design. Mandate is the same principle carried one
layer higher, from "can this agent spend this much, here" to "is this specific declared
reason for spending actually true." It does not compete with the Agent Control Layer. It
sits on it.

Concretely, the build uses:

- **Rain's collateral-backed card issuance** (`issueScopedCard` in `lib/rain-client.ts`),
  the same primitive shown live in Rain's own "Wednesday We Wear Pink" reference demo during
  the workshop: onramp → store stablecoins → user authorizes agent → **scoped virtual card
  issued, locked to merchant and amount** → agent completes the transaction → **card
  retired automatically once the job is done.** Mandate's issue/settle/revoke stages are
  that exact flow.
- **The team's own collateral contract**, pre-provisioned (`RAIN_COLLATERAL_CONTRACT_ID`),
  meaning the KYC and contract-deployment steps Rain normally requires were already done for
  Team 10 by Rain, and the build starts at the step that matters, issuance.

---

## 4. Why this hackathon, specifically

Three of the five judges work at Rain: Ross Basri (product lead, launched Rain Rewards),
Farhan Khwaja (engineer, high-throughput transactional systems, custody infrastructure),
Juan Blanco (data engineer, has personally won Ethereum hackathons in Amsterdam and Paris,
so he will recognize a staged demo on sight). The other two are Siggy Bilstein
(Engineering Manager at Cursor, works on an agent-native git forge) and Jarrod Watts (AI
Engineering Lead at Monad, works specifically on agent orchestration).

This shaped four concrete build decisions:

- **The lead demo moment is unfalsifiable, not scripted.** Issue a card for a PO, then
  submit the identical PO again. It is refused by the idempotency check, reading the record
  the first run itself wrote. Nothing is authored for the demo. This exists because Juan
  Blanco would spot a hand-authored "bad agent" fixture in seconds.
- **No LLM anywhere in the verify path.** Every check in `lib/verify.ts` (B's side) is a
  pure function. This is what makes replay meaningful, editing a rule and re-running history
  only proves something if the thing being re-run is deterministic. Farhan builds
  transactional systems for a living; "trust me, the agent judged it fairly" does not survive
  contact with that judge.
- **The rule-version Monad anchor, not a per-decision one.** Anchoring every decision is a
  gesture. Anchoring each rule version is structural, it is what proves the rules were not
  quietly rewritten to fit a history after the fact, and it is the honest answer to Jarrod's
  own stated bounty bar: *"the chain has to matter, would it break at 15 second finality or
  50 cents a transaction?"* You can only afford to anchor rule history because Monad is this
  cheap.
- **The negotiation stage stays deliberately thin**, one vendor comparison rather than a
  multi-agent haggling performance, specifically because Jarrod's actual job is agent
  orchestration and a shallow simulated negotiation is the easiest thing in the room for him
  to see through.

---

## 5. How it covers all four submission categories

The event's tracks are not mutually exclusive submissions, one build can qualify for
several with different framing. Rain's own workshop slide named four shapes for
"Autonomous spend": **Autonomous spend, Global money movement, Treasury and payouts, Agent
negotiation.** Mandate maps to two of Rain's own four, plus the general track and the Monad
bounty:

| Category | How Mandate qualifies |
|---|---|
| **Best use of Rain** | Card issuance is the enforcement point, matching Rain's own architecture and their published "at issuance, not after the fact" principle exactly |
| **General track, "agents actually move money"** | Real settlement through a real scoped virtual card, not a simulation |
| **Agent negotiation** | The quote stage produces the accepted PO the card is bound to; described honestly as quote-selection rather than an inflated multi-round negotiation |
| **Monad bounty** | Real testnet transactions (rule-version hashes), where the chain's low cost is structurally why the audit claim can hold at all, not a decorative add-on |

One pipeline, one architecture, two owners. Not four separate projects chasing four prizes.

---

## 6. What was deliberately not built, and why

Documented in full in `IDEAS.md`, `THE-IDEA.md`, and `ABI-LESSON.md`. In short:

- **Delegated budget trees** — too close to Rain's own program-level caps, would read as
  rebuilding their product rather than extending it.
- **Agent Underwriting** (a second collateral pool taking on liability) — needs Rain
  identities the team was not issued. Kept as one forward-looking sentence in the close.
- **Burn Rate streaming limits** — needs an unconfirmed Rain capability (live limit updates
  post-issuance) plus a Monad streaming contract from scratch. Two coupled unknowns on one
  afternoon.
- **Four-Eyes consensus voting** — rejected on principle, not just time. LLM agents voting
  reintroduces a model into the verify path, which directly undoes the reason replay works
  at all.
- **A per-decision Monad fee, a live budget meter, a judge-editable form** — all real, all
  kept as optional additions, none load-bearing, all cut before anything in the core loop.

This scoping follows directly from a prior hackathon loss (Pulse Foundry × ABI Frameworks,
2026-06-28): the team built roughly 85% of the winning system's substance and still lost,
to a team whose actual edge was a versioned, biller-editable rules config and a "re-run
instantly" toggle. Mandate's replay feature is that same idea, built properly, from the
start, rather than bolted on after losing to it once.

---

## 7. Stack and repo layout

Next.js 14 App Router, TypeScript, Tailwind. Deployed on Vercel, required, locally-hosted
submissions are disqualified per the event's own rules.

```
lib/
  types.ts          shared PurchaseOrder / VendorQuote / CheckResult shapes (A + B contract)
  money.ts          integer cents, never floats
  rain-client.ts     Rain API wrapper (A)
  quotes.ts          vendor quote fixtures + selection (A)
  agent.ts           task -> PurchaseOrder (A)
  verify.ts          the six checks, rule versioning, replay (B)
  db.ts              append-only decision log storage (B)
app/
  api/rain/ping/     the first-authenticated-call milestone
  api/purchase/      the 17:00 join: agent proposes -> verify -> issue
  api/replay/        re-run history against an edited rule version (B)
docs/                this file, and the full planning trail
```

Repo: `github.com/theomthakur/raingentic-team10`, public per the event's rules,
`.env.local` never committed, only `.env.local.example`.
