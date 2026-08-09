# Mandate

**The control layer between an autonomous purchasing agent and company money.**

Mandate lets an agent source and negotiate a purchase, then proves that the exact purchase is allowed before it can receive a payment instrument. A failed policy check creates no card.

**Live demo:** [raingentic-team10.vercel.app](https://raingentic-team10.vercel.app)

Built by Team 10 for the Raingentic Commerce Hackathon NYC, August 2026.

## What a judge can do

1. Open **Start** and give Mandate a task, such as “I need two boxes of A4 paper.”
2. Watch it route the goal to a specialist, compare modeled supplier offers, and choose a qualifying PO.
3. See eleven deterministic checks either approve, hold, or refuse that PO.
4. Open **Orders** to see the same persistent decision log and budgets.
5. Open **How it works** to inspect the Rain, Monad, and Postgres boundaries.

The customer-facing flow is intentionally simple. The proof is available when a reviewer wants it; it is not required to use the product.

## How it works

```text
Goal → specialist → supplier offers → exact PO → eleven policy checks
                                                  │
                                  refuse / hold ←┴→ verify Monad policy receipt
                                                            │
                                               issue a Rain scoped card
                                                            │
                                             record the outcome in Postgres
```

### Controls before payment

Mandate checks the proposed purchase against an immutable snapshot: PO state, quote expiry, amount, vendor and SKU match, budget, duplicate issuance, delegated authority, spend structuring, agent limits, vendor history, and spend velocity. Rules are versioned data, so historical decisions can be replayed against a proposed policy change.

### Integrations

| Service | What Mandate uses it for |
|---|---|
| **Rain sandbox** | Scoped-card issuance, authorization/transaction lifecycle reads, collateral endpoint, and sandbox payment-route simulations. |
| **Monad testnet** | Anchors the active policy version hash. Mandate verifies the exact transaction and receipt before autonomous card issuance can proceed. |
| **Postgres** | Persistent append-only decisions, purchase evidence, budgets, and policy versions. |
| **Groq** | Optional language-model assistance for intake and supplier commentary; it is deliberately outside the deterministic policy decision. |

## What is real—and what is modeled

| Capability | Status |
|---|---|
| Decision log and policy versions | Persistent Postgres data |
| Policy anchor | Real Monad **testnet** transaction and receipt verification |
| Supplier offers and negotiation participants | Modeled supplier profiles, not partner supplier APIs |
| Scoped-card and treasury interfaces | Rain **sandbox** integrations |
| Payment-route / treasury response | `accepted` by the sandbox, not settled and not a movement of real customer funds |

This distinction is deliberate. Mandate does not describe a sandbox acceptance as a settled payment, and it does not represent modeled suppliers as live merchant integrations.

## Conditional treasury payout

`POST /api/treasury/payout` is separate from the supplier-card flow. It requires an `amountUsd`, `purpose`, and `policyRef`; the canonical combination is SHA-256 hashed and passed to Rain as the idempotency key. The response exposes the canonical string and hash so the stated authority can be checked independently.

It returns `accepted-by-rain-sandbox` with `settled: false`. That is an accepted sandbox simulation—not a claim that a recipient received funds.

## Run locally

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

```bash
npm test          # 159 checks across policy, rail, lifecycle, and treasury suites
npx tsc --noEmit
npm run build
```

The app works without credentials using clearly labeled local simulations. For a persistent deployed environment, set `DATABASE_URL`. See [`.env.local.example`](.env.local.example) for the optional Rain, Monad, Groq, and payment-route settings.

## Repository map

| Path | Responsibility |
|---|---|
| `lib/pipeline.ts` | The purchase sequence and the pre-issuance policy gate |
| `lib/checks/` | The eleven pure, deterministic policy checks |
| `lib/rules/` | Versioned rules and canonical policy hashing |
| `lib/monad/` | Monad testnet policy anchor and receipt verification |
| `lib/rain/` | Rain sandbox cards, lifecycle, routes, and conditional treasury payout |
| `lib/store/` | Append-only decision log backed by Postgres when configured |
| `app/api/` | The API surface used by Start, Suppliers, Orders, and Proof |
| `docs/` | Design notes, deployment notes, and hackathon context |

## Team

Princy Doshi · Om Thakur
