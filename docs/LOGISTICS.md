# Raingentic, Team 10

## Credentials

Handed out on paper. **The sheet says: "Treat the API key as a secret and keep it to
yourself. It belongs to this team only, and it stays out of screenshots, repos, and
shared channels."**

The non-secret identifiers:

| | |
|---|---|
| Team | **Team 10** |
| Team ID | `75733962-05fc-4e05-b459-dd48b8fff955` |
| User ID | `f0dc00d4-bb50-4730-8d59-625296e5b1b8` |
| Collateral contract ID | `b96c5a77-8fca-4c6b-8966-de7385cae27a` |
| API key | **on the paper sheet only. Type it straight into `.env.local`.** |

### Handling the key

```bash
# .env.local  (already gitignored, never commit this file)
RAIN_API_KEY=...            # from the paper, typed not pasted from anywhere shared
RAIN_TEAM_ID=75733962-05fc-4e05-b459-dd48b8fff955
RAIN_USER_ID=f0dc00d4-bb50-4730-8d59-625296e5b1b8
RAIN_COLLATERAL_CONTRACT_ID=b96c5a77-8fca-4c6b-8966-de7385cae27a
```

- Commit a `.env.local.example` with empty values, never the real file
- Before the first push: `git ls-files | grep -i env` should return only the example
- If it ever lands in a commit, tell a Rain engineer and get it rotated. Deleting it in a
  later commit does not remove it from history.
- Keep it out of the demo too. No env panel on screen, no terminal with it echoed.

## Submission

**Everything happens on the Encode platform**, via the QR on the table.

- [ ] **Every team member signs up individually on the program page.** Stated as a
      requirement, not a suggestion.
- [ ] Create the project on the platform
- [ ] Submit it there
- 🔴 **Submissions close 12:00 PM Sunday.** Aim to submit before leaving Sunday morning.

Discord is on the same platform, for questions and support.

## On site

| | |
|---|---|
| WiFi | `Rain Guest` / `RainDrop#2026` |
| Saturday | 11 E 26th St, 11th floor |
| Sunday | **50 W 23rd St, 4th floor** (different building) |
| Help | Rain engineers on site, or Discord |

⚠️ If you leave the building today you have to check back in at the front desk to be
badged up again.

## To confirm today

- [ ] Demo time tomorrow: Luma says 3:15 PM, the email blast says 16:00. Ask an organiser.
- [ ] Who else is on Team 10.
