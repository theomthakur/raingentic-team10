# Team 10, current state

One page. Read this, then read `THE-IDEA.md` if you need the why.

---

## The idea

**Mandate.** An agent gets a scoped virtual Rain card bound to the exact purchase order it
negotiated, vendor, SKU, price, expiry. Any deviation means no card is ever issued.

One build, all four submission categories: Best use of Rain, general "agents move money,"
Agent negotiation (a small stage that produces the PO), Monad bounty (each decision hashed
and anchored as a real testnet transaction).

## Repo

`github.com/theomthakur/raingentic-team10`, pushed, one commit, scaffold only (Next.js,
Tailwind, `.gitignore` covers `.env.local`). **Repo must be public**, confirmed rule.

## Credentials

Team 10. Team ID, User ID, Collateral contract ID are in `.env.local.example` and
`LOGISTICS.md`. **The API key is on the paper sheet only**, never written anywhere digital,
type it straight into your own local `.env.local`.

## The split

| | Owns | Blocked by Rain? |
|---|---|---|
| **A** | Rain auth, card issuance, collateral draw, the spending agent, the negotiation stage | Yes |
| **B** | The six checks, fixture data, rule versioning + replay, UI, diagram, pitch | No, can start immediately |

**Join at 17:00.** A real check result decides whether a real card is issued. If not joined
by 18:00, cut scope rather than push the join later.

## 🔴 Open right now, ask a Rain engineer

1. **Can we simulate an authorization** against a card we issue? Shapes whether the demo
   can show a decline, or only issuance.
2. **Does card issuance lock to one exact merchant, or only a category?** Decides whether
   the vendor-mismatch point is "Rain would have allowed this" or the weaker "we stop it
   before Rain is asked."
3. Base URL and auth header to use this weekend.
4. Is the collateral already funded, or do we need to send RUSD first.

## The demo's lead failure case

**Not vendor mismatch.** Lead with a duplicate spend on an already-fulfilled order line, or
a SKU mismatch (right vendor, right price, wrong item). Neither exists in any card
network's controls at any granularity, a card issuer does not know your order system
exists, so this claim holds regardless of what question 2 above comes back with.

## The six checks (rule 4 is now secondary, see above)

1. Order/PO exists
2. Order still open, not already fulfilled
3. Amount matches the quote
4. Merchant matches the quote *(secondary point now, confirm framing first)*
4b. **Duplicate spend or SKU mismatch** *(lead with this)*
5. Within remaining budget
6. No card already issued for this line *(idempotency)*

## What's explicitly not being built

Delegated budget trees (too close to Rain's own controls), replay as the headline product
(weak without live issuance), Burn Rate streaming limits (needs an unconfirmed Rain
capability plus a Monad contract from scratch), Four-Eyes consensus voting (puts a model
back in the verify path, undoes design decision 2). All reasoning in `THE-IDEA.md`.

**Two small additions if time allows, same cut priority as the Monad anchor:** a tiny real
Monad fee per recorded decision, and a live budget meter in the UI. Neither is required.

## Schedule

Build window 13:00-21:00 today. Join at 17:00. Sunday 09:00-12:00 is fix-and-polish, not
new work. **Submit as soon as it's genuinely ready**, pitching order follows submission
order, so early is strictly better than buffered.

Demo time Sunday: Luma says 3:15pm, the email blast says 4:00pm. Unconfirmed, ask on site.

## Read next, in order

1. `THE-PLAN.md` — architecture, full schedule, cut lines
2. `DESIGN-DECISIONS.md` — the six decisions and why each matters
3. `RAIN-API.md` — the confirmed card flow, the engineer questions in full
4. `ABI-LESSON.md` — why this is scoped the way it is
