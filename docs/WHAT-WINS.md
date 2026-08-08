# What has actually won in agentic commerce hackathons

Researched 2026-08-08. Public recaps only, no code copied from anyone.

---

## 🔴 The single most important thing to know

**Rain shipped an "Agent Control Layer" in June 2026.** It is their own product, and their
framing of the problem is this:

> "To scale that activity, businesses need to **bound what an agent can do**, keep its
> activity **auditable**, and adjust the limits as workflows grow."

And the part that matters most:

> "The controls are **enforced at card issuance and transfer initiation rather than applied
> after the fact.**"

Transactions that violate the rules **do not proceed**. They are not flagged afterwards.

That is, almost word for word, the thing Om has built 42 demos around: the agent proposes,
deterministic code decides, and the check happens **before** the action rather than as an
audit afterwards.

**What the Agent Control Layer actually offers:** per-transaction amount limits, merchant
and category allowlists, spend intervals, card expiry, program-level caps on active cards
and aggregate spend, plus counterparty restrictions on transfers.

**Two judges are Rain engineers and one is Rain's product lead.** They will recognise the
vocabulary instantly.

### The trap this creates

If Om builds "spending guardrails for agents," he is rebuilding Rain's own product in front
of the people who built it. That reads as either "he gets it" or "he did not read our docs."

**So build ON the control layer, not a replacement for it.**

---

## Where the actual gap is

Rain's control layer bounds **how much** and **where**. It cannot know **why**.

An agent with a card limited to $200 at office-supply merchants can buy entirely the wrong
thing, at an allowed price, from an allowed merchant, for a reason it invented. Every
control passes. The purchase is still wrong.

**Nobody is checking whether the stated reason for the spend was true.**

That is one level above what Rain enforces, it is the same verification pattern Om already
owns, and it is not what any prior winner built.

Shape of it: the agent declares an intent before it spends ("buying X because of Y, for
order Z"), and deterministic code checks that declaration against the actual system of
record before the transaction is authorised. If the reason does not hold, the spend does
not happen, and the refusal is legible.

⚠️ **This is an angle, not a plan. Do not build anything until the brief is in hand.**

---

## What has actually won

### SF Agentic Commerce x402 Hackathon (Feb 2026, Coinbase / Google / Virtuals, $50k+)

| | |
|---|---|
| **1st: World of Geneva** | An MMORPG where AI agents autonomously play, complete quests, fight, and **trade items** while humans watch. Pure spectacle. |
| **2nd: Legasi** | A **credit and reputation layer for AI agents**: credit lines, x402 payments, yield on idle funds, on-chain reputation. |

Other teams built agent wallets with spending limits, batched settlement, and payment
proxies.

### Agentic Commerce on Arc (1,200 builders)

| | |
|---|---|
| **1st: OmniAgentPay** | A Python SDK giving agents one `pay()` call that handles USDC, x402 API payments and cross-chain transfers, **with built-in safety guards**. |
| **2nd: Arc Merchant** | Autonomous x402 micropayments. |
| **Notable: RSoft Agentic Bank** | Trustless lending for agents using **KYA (Know Your Agent)**, the AP2 protocol for authorized spending, and a multi-agent system for **real-time risk scoring**. |

Judges were impressed enough that Google raised the prize pool from $10k to $40k mid-event.

### BSV AgenticPay (Apr 2026)

**Grand prize: Dolphin Sense.** An autonomous newsroom running **90 AI agents, each with
its own wallet**, that discover, negotiate and settle payments between themselves via
micropayments.

### Solana x402 (Dec 2025)

Sentinel Agent (on-chain AI payment platform), Galaksio (USDC for compute and storage),
ParallaxPay (AI agent marketplace), Learn Earn.

### Coinbase Agents in Action (Jun 2026)

Decentralized payroll, protocol fee routers, pay-per-use marketplaces.

---

## The stated judging criteria, from the SF event

> **Partner integration · agentic depth · commerce realism · polish and ship-ability**

Plus: *"shipping real demos that integrate x402 into an actual payment/commercial flow."*

---

## The four patterns

**1. Infrastructure beats applications.** OmniAgentPay, Legasi and RSoft Bank all won by
being the layer other agents use, not by being one clever agent. A payment SDK took first
place over hundreds of apps.

**2. Safety and authorization is a repeat winner.** "Built-in safety guards." "Know Your
Agent." "Real-time risk scoring." "Authorized spending." "Agent wallets with spending
limits." It comes up in every single event. This is the most reliable winning theme in the
category, and it is Om's strongest angle.

**3. Many agents transacting with each other demos spectacularly.** Dolphin Sense's 90
agents, World of Geneva's autonomous players. A screen with money visibly moving between
agents is worth more than a static architecture slide.

**4. Spectacle can win outright but is a coin flip.** World of Geneva beat serious
infrastructure with a game. Do not plan for this. It is not repeatable and it is not what
Rain is hiring for.

---

## What this means for Team 10

**Aim at the intersection of 1 and 2: a thin, credible layer that makes an agent's spending
provably correct, built on Rain's controls rather than around them.**

Then borrow from 3 for the demo: show the money actually moving, and show one transaction
being **stopped** with a legible reason. A refusal is a better demo moment than a success,
because everyone else's demo will be a success.

### For the pitch

- **Name the Agent Control Layer.** Show you read what they shipped in June.
- **Say what your layer does that theirs cannot**, in one sentence, without implying theirs
  is lacking. It bounds the spend; yours checks the reason.
- **One architecture diagram**, numbered stages, shown early. From the WoundScope loss: the
  diagram is the pitch at a system-design-judged event.
- **Make the rules configurable data, not hardcoded.** That was the single decisive gap
  last time.
- **Draw the "production scale, out of scope today" lane.** It pre-answers the scaling
  question honestly.

---

## ⏰ A scheduling problem worth naming

Submissions close **12:00 PM Sunday**. The teammate arrives **Sunday**.

Saturday build time is 13:00 to about 21:00, roughly **8 hours**. Sunday morning is
**3 hours** before the deadline.

So realistically the thing has to be built today, and Sunday morning is for polish, the
README, the deploy and the submission. Plan the scope for one person today, and treat
tomorrow's help as finishing rather than building.

---

## Sources

- [SKALE: SF Agentic Commerce x402 recap and winners](https://www.skale.space/blog/san-francisco-agentic-commerce-x402-hackathon-recap-winners)
- [lablab.ai: Agentic Commerce on Arc recap](https://lablab.ai/ai-hackathons/agentic-commerce-on-arc)
- [BSV AgenticPay winners](https://www.prnewswire.co.uk/news-releases/bsv-associations-open-run--agenticpay-hackathon-concludes-with-10-000-awarded-across-five-winning-projects-302762609.html)
- [Algorand: Berlin x402 recap](https://algorand.co/blog/agentic-commerce-x402-hackathon-berlin-recap)
- [Coinbase: Agents in Action winners](https://www.coinbase.com/developer-platform/discover/launches/agents-in-action-winners)
- [Rain: Introducing the Agent Control Layer](https://www.rain.xyz/resources/introducing-the-agent-control-layer)
- [Rain Agent Control Layer press release](https://www.prnewswire.com/news-releases/rain-releases-agent-control-layer-bringing-programmatic-spending-guardrails-to-agentic-payments-302794541.html)
