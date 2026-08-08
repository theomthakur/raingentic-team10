# Rain API — what is actually confirmed

Verified against the live sandbox on 2026-08-08, not inferred from public docs.
`RAIN-API.md` is the earlier guesswork; **where the two disagree, this file is right.**

---

## Auth — the header is `api-key`

Not an Authorization bearer. The API names the header in its own error, which is how this
was settled rather than guessed:

```
401  {"statusCode":401,"error":"Unauthorized",
      "message":"headers is missing required property 'api-key'"}
```

```ts
headers: { "content-type": "application/json", "api-key": process.env.RAIN_API_KEY }
```

Base URL `https://api-dev.raincards.xyz/v1` is correct.

## The surface lives under `/issuing`

Everything in `RAIN-API.md` that guessed `/contracts/...` or `/users/...` returns 404 or
403. The real routes:

| Method | Path | Result |
|---|---|---|
| GET | `/issuing/cards` | ✅ 200, array of cards |
| GET | `/issuing/users` | ✅ 200, array (1 for this team) |
| GET | `/issuing/users/{userId}` | ✅ 200, the user object |
| GET | `/issuing/users/{userId}/contracts` | ✅ 200, **empty for us** |
| GET | `/issuing/transactions` | ✅ 200, empty |
| GET | `/issuing/companies` | ✅ 200, empty |
| **POST** | **`/issuing/users/{userId}/cards`** | ✅ **creates a virtual card** |
| PATCH | `/issuing/cards/{cardId}` | route exists |
| GET | `/contracts/{id}`, `/cards`, `/users/...` | ❌ 401/403/404 |

No OpenAPI spec is exposed (`/documentation/json`, `/openapi.json` etc. all 404).

## Account status

```
applicationStatus : approved
isActive          : true
termsAccepted     : true
collateral contracts: 0      ← see below
companies           : 0
```

KYC is done. **But no collateral contract is linked to the user**, so a card issued today
has no spending power behind it.

🔴 **Ask a Rain engineer:** the credentials sheet gives a Collateral contract ID, but
`GET /issuing/users/{userId}/contracts` returns `[]` and `GET /contracts/{id}` returns 403.
Does it need attaching to the user, funding with RUSD, or is it reachable another way?

## Card creation

`POST /issuing/users/{userId}/cards` requires exactly one property: `type`.

```jsonc
{ "type": "virtual" }        // → 200, card created
```

The response:

```jsonc
{
  "id": "…", "userId": "…", "type": "virtual", "status": "active",
  "last4": "1031", "expirationMonth": 10, "expirationYear": 2032,
  "configuration": { "currency": "usd" },
  "createdAt": "…", "updatedAt": "…"
}
```

⚠️ **A minimal card is the exact anti-pattern this project exists to prevent.** With only
`type` supplied you get an active card, no spending limit, and a **six-year** expiry, bound
to nothing. Mandate must always send an explicit limit and a short expiry — the default is
not safe, and that contrast is worth showing in the demo.

🔴 **Still unknown, ask an engineer:** what goes in `configuration` to set a spending
limit, a merchant or category allowlist, and a short expiry. The field exists and comes
back as `{ "currency": "usd" }`, but the accepted schema is not discoverable from errors,
because the endpoint accepts a one-field body rather than validating the rest.

## Deactivation — unresolved

`PATCH /issuing/cards/{cardId}` exists and accepts an empty body, but
`{"status":"inactive"}` returns **400**. The accepted value is unknown.

🔴 **Ask an engineer for the card status enum.** It is a one-line answer and it unblocks
stage 7 REVOKE, which is otherwise cheap credibility nobody else will show.

## An artefact on the account

While mapping the API, a card was created unintentionally — the endpoint returned 200 for a
one-field body where a validation error was expected.

```
id      ab3ea8c1-b0f3-4409-a7fb-a351e6a4d3ce
status  active      last4 1031      expires 10/2032
config  { "currency": "usd" }       no spending limit
```

It has no collateral behind it and no real money is involved, but it is still there, and
deactivating it is blocked on the status enum above. Either turn it off once that is known,
or keep it deliberately as the demo's foil: the unscoped card, next to a Mandate card
scoped to one purchase order and expiring with its quote.

## Inspecting the account

```bash
DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/rain-explore.ts status
DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/rain-explore.ts cards
DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/rain-explore.ts map
```

Read-only, and prints no key and no personal data.

## Handling the key

`.env.local` is gitignored and untracked; the key is in no tracked file. Note that
`scripts/check-rain-connection.ts` loads `dotenv/config`, which reads `.env` and **not**
`.env.local` — hence the `DOTENV_CONFIG_PATH=.env.local` prefix on every command above.
