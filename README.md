# Mandate

An agent has to declare why it's spending before Rain will issue the card, and the reason
gets checked against the real order before any money moves.

Built for the Raingentic Commerce Hackathon NYC, Team 10.

## The idea

Rain's Agent Control Layer bounds how much an agent spends and where. Nothing checks why.
An agent with a card scoped to the right merchant and the right amount can still buy the
wrong thing, for a reason it invented.

Mandate checks the reason. Before an agent spends, it declares a structured intent, tied
to a real order. Deterministic code verifies that declaration against the record. If it
fails, no card is issued at all.

Setup and architecture: see `docs/` and the team's full planning notes.
