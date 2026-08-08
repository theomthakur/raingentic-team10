# Deploying, and the one thing that will quietly break

Locally-hosted submissions are disqualified under the event's own rules, so this has to be
live on a URL. It is a stock Next.js app and deploys to Vercel with no configuration.

---

## 🔴 Set `DATABASE_URL`, or replay breaks on the URL you submit

This is the single most likely way to lose the demo, and it is dangerous precisely because
**everything works perfectly on a laptop either way.**

Vercel runs serverless: module memory does not survive a cold start and the filesystem is
ephemeral. With no database:

- the append-only decision log **empties whenever the instance goes idle**
- **replay** — the feature that cannot be cut — has nothing to replay
- it will look fine when you test it, then be empty when a judge opens the link ten
  minutes later

The app now says so on screen if it is running in production without a database. Do not
ship with that banner showing.

### Getting one, in about three minutes

1. Create a free Postgres at [neon.tech](https://neon.tech) (or Supabase — any Postgres
   connection string works).
2. Copy the connection string.
3. Vercel → Project → Settings → Environment Variables → `DATABASE_URL` → paste → save.
4. Redeploy.

Tables are created automatically on first request, and the 54 seeded decisions are loaded
so replay has real history immediately.

---

## Environment variables

| Variable | Needed? | What happens without it |
|---|---|---|
| `DATABASE_URL` | 🔴 **Yes, in production** | The log empties on cold start and replay breaks |
| `RAIN_API_KEY` | For real cards | Cards are simulated and clearly labelled as such |
| `RAIN_USER_ID`, `RAIN_BASE_URL` | With the above | — |
| `RAIN_CARD_INACTIVE_STATUS` | For real card retirement | Cards retire locally only, labelled simulated |
| `MONAD_RPC_URL`, `MONAD_PRIVATE_KEY` | For the anchor | The anchor button is absent; nothing else changes |
| `GROQ_API_KEY` | Optional | Sellers use their written dialogue instead of generated lines |

**Never commit `.env.local`.** Before pushing:

```bash
git ls-files | grep -i env      # must return ONLY .env.local.example
```

---

## Before showing it to anyone

- [ ] `DATABASE_URL` set, and **no red banner** on the deployed page
- [ ] Open the deployed URL **on a phone, on cellular** — not just the laptop that built it
- [ ] Run a task, then run it again → the second is refused. On the deployed URL, not localhost
- [ ] Change a rule and replay → the diff shows real numbers, meaning the seeded history loaded
- [ ] Wait ten minutes, reload → **the decisions are still there.** This is the actual test
- [ ] Press "Reset demo" so the next judge starts clean

That fifth item is the one worth being pedantic about. Everything else fails loudly; this
one fails by looking empty.

---

## Running it locally

```bash
npm install
npm test        # 78 tests over the checks, hashing, replay and concurrency
npm run dev
```

Nothing is required to run locally. With no `DATABASE_URL` it uses an in-memory store —
which is exactly right for development and exactly wrong for the deployment.
