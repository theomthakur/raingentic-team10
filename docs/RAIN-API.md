# Integrating Rain, what is actually callable

Pieced together from public sources. **Confirm all of it with a Rain engineer on site**,
their full docs at `docs.rain.xyz` are behind an access code the hackathon should give you.

---

## The good news

Your credentials sheet already includes a **Collateral contract ID**
(`b96c5a77-8fca-4c6b-8966-de7385cae27a`).

In the normal Rain flow you would have to do KYC and deploy a collateral contract before
you could issue anything. **Rain has done both for Team 10 already.** You start at the step
that matters: issuing cards.

---

## The normal flow, and where you join it

| # | Call | Status for you |
|---|---|---|
| 1 | `createRainUserApplication()` — KYC submission | ✅ pre-done, you have a User ID |
| 2 | `createRainUserContract()` — deploys the collateral-holding contract | ✅ pre-done, you have the contract ID |
| 3 | **`issueRainCard()` — virtual Visa with configurable spending limits** | 🔴 **this is where you build** |
| 4 | `getRainUserCards()` — list cards | |
| 5 | `getRainUserContracts()` — deposit addresses, token balances | |
| 6 | `getRainUserCreditBalances()` — `creditLimit`, `spendingPower`, `balanceDue` | |
| 7 | `getRainUserStatus()` — application status | |
| 8 | `getRainUserByWalletAddress()` — look a user up by wallet | |

## The objects

**Card:** card id, type, status (active / inactive), last four, expiration, and **a limit
with a frequency and an amount**.

**Collateral contract:** contract id, deposit address, token balances. Funded with **RUSD**
sent to the deposit address. That collateral is what backs the card's spending power.

**Credit balance:** `creditLimit`, `spendingPower`, `balanceDue`, in cents.

## Environment

- Sandbox base URL seen publicly: **`https://api-dev.raincards.xyz/v1`**
- Collateral contracts deploy on **Base Sepolia** (chain id `84532`) in the public example
- Sandbox KYC shortcut: **`lastName: "approved"`** skips verification
- Interactive Swagger reference at `docs.rain.xyz`, access code needed

⚠️ The hackathon may point you at a different base URL. **Ask.** Do not lose an hour
guessing.

---

## 🔴 Why this makes idea #1 work

Rain's own framing of the Agent Control Layer:

> "The controls are **enforced at card issuance** and transfer initiation rather than
> applied after the fact."

**Card issuance is the enforcement point.** And card issuance is exactly the call you have
credentials for.

So the shape of intent-bound spending falls out naturally:

```
agent declares a structured intent
        |
        v
deterministic check against the record        <- pure functions, no model
   does the order exist?
   is it still unfulfilled?
   does the amount match the quote?
   is this merchant the one on the quote?
        |
   pass  |  fail
        |     \
        v      \--> no card is issued. the refusal is the output.
issueRainCard(
  limit: exactly this purchase amount,
  frequency: single use,
  expiry: short
)
```

**A failed check does not produce a blocked transaction. It produces no card at all.**
There is nothing to block, because the instrument was never created. That is a stronger
story than a decline, and it is Rain's own thesis taken one level further: they bound the
amount, you bound the reason.

---

## Ask a Rain engineer these five things

Worth doing in the first hour, before you write anything.

1. **What base URL and auth header should we use this weekend?** Is the API key a bearer
   token, an `x-api-key`, something else?
2. **Does the card issue endpoint accept merchant or category allowlists**, or only amount
   and frequency? That decides how much of the control layer you can actually demonstrate.
3. **Is the collateral already funded**, or do we need to send RUSD to the deposit address
   first? If we do, where do we get test RUSD?
4. **Can we simulate an authorization** against a card we issued, so the demo shows a real
   decline rather than just a created card? This is the single most important question for
   the demo.
6. **What does the Agent Control Layer not cover yet that you wish it did?** Their answer
   is a map to open ground, from someone who works with the judges.

---

## The one risk to close early

Everything above lets you **issue** a card. If you cannot **spend** on it in sandbox, your
demo ends at "we created a card with the right limit," which is much weaker than "the agent
tried to buy the wrong thing and the money never moved."

**Question 4 is the one to ask first.** If simulated authorizations are not available,
restructure the demo around issuance and refusal rather than around a decline, and find
that out at 1pm rather than at 8pm.
