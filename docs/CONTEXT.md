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

## 🔴🔴 DECIDE THIS NOW, before more checker code is written

**Storage.** In-memory or on-disk state does not survive Vercel's serverless cold starts.
The append-only decision log needs somewhere real to live or replay breaks silently on the
deployed URL, the one thing you cannot cut. **Pick Neon Postgres (free tier, fits the
append-only model directly) or Vercel KV/Upstash (faster to wire).** B owns this call, make
it before writing more checks against an assumption that won't survive deploy.

## 🔴 Open right now, ask a Rain engineer

1. **Can we simulate an authorization** against a card we issue? Shapes whether the demo
   can show a decline, or only issuance.
2. **Does card issuance lock to one exact merchant, or only a category?** Decides whether
   the vendor-mismatch point is "Rain would have allowed this" or the weaker "we stop it
   before Rain is asked."
3. Base URL and auth header to use this weekend.
4. Is the collateral already funded, or do we need to send RUSD first.

## The demo's lead failure case: run it twice, don't script a bad agent

**The vendor-mismatch refusal is fakeable and a judge who's won hackathons himself will
clock it in ten seconds**, you wrote the fixture, the bad agent, and the check that catches
it. Replace it:

1. Run the task. Card issued, money moves, the record gets written.
2. **Press the same button again.** No new fixture, no second agent.
3. Refused, by rule 6 (idempotency), reading the record the *first run itself wrote.*

This is unfalsifiable in the best way, the refusal is a consequence of the demo's own first
half, not a script. It also costs nothing new to build, rule 6 is already in the plan.

**Stretch, if there's time: let a judge edit the PO on screen and press issue themselves.**
Turns the whole claim from "trust us" into "try it." Ten lines of UI.

## The pitch line for the first hard question

If a judge reduces the six checks to *"so it's a foreign key and a uniqueness constraint
before the API call"*, the answer is ready: **this is a pre-issuance three-way match**, the
same PO/receipt/invoice reconciliation every ERP does, just moved from after the invoice
arrives (where the remedy is a dispute or a clawback) to before the card exists at all.
Zero build cost, just the vocabulary a finance person in the room already trusts.

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

**Two small additions if time allows, lowest priority, cut first:** a tiny real Monad fee
per recorded decision, and a live budget meter in the UI.

## 🔴 Reprioritized: negotiation is now cut line #1, not #2

Two seller agents you wrote, haggling to a number you chose, is the most fakeable thing on
screen, in front of the judge whose actual job is agent orchestration. If it survives the
cut, describe it honestly as a **quote-selection stage**, not a negotiation.

## Monad, reprioritized: anchor the rule version, not just decisions

Replay proves the rules are data. It does not prove the rules weren't edited after the fact
to fit history you already had. **Anchoring a hash of each rule version on Monad closes
that hole and is structural**, not decorative, unlike the per-decision fee. Do the
rule-version anchor first; it's also cheaper, one transaction per version, not per decision.

## Two cheap adds worth more than what they'd displace

- **Revoke the card after settlement.** Rain's own line is cards are "retired automatically
  once the job is done." Confirm the endpoint, then show it. Nobody else will.
- **Seed 40-50 historical decisions before demoing replay.** Six live rows reads as a test
  file. "Across 47 decisions, six approvals would now be refused" reads as a real system.
  Half an hour of fixture writing.

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
