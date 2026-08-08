# The controls, and what they are based on

Every rule in Mandate implements a control that already exists in finance or in AI
governance. None of them were invented for this project. This matters because the honest
answer to *"why should I trust software to spend my money?"* is not "our rules are clever" —
it is **"these are the controls your finance department already runs, moved earlier."**

⚠️ **Verify the specifics before quoting them at a judge.** These are the frameworks the
controls map to, summarised from general knowledge. Framework version numbers and article
numbers should be checked against the source before anyone states them as fact on stage.

---

## 1. Three-way match → rules 1, 2, 3, 4

**The established control.** Accounts payable does not pay an invoice until three documents
agree: the **purchase order** (what we agreed to buy), the **goods receipt** (what actually
arrived), and the **invoice** (what we are being asked to pay). Any mismatch stops payment.
This is standard practice in every ERP — SAP, Oracle, NetSuite all ship it.

**What Mandate changes.** The classic match happens *after the invoice arrives*, which is
after the money is committed. The remedy is a dispute, a clawback, or a write-off.

> Mandate runs the match **before the card exists**. Rules 1–4 are the PO side of a
> three-way match: does this order exist, is it still open, does the amount match, does the
> supplier and the item match.

**Why it is the right frame.** A judge who compresses our checks to "a foreign key and a
uniqueness constraint" is correct about the mechanism and wrong about the significance.
Moving a hundred-year-old control earlier in the lifecycle is the contribution.

## 2. Delegation of authority / approval thresholds → rule 7

**The established control.** Every company runs a **Delegation of Authority matrix**: a team
lead can approve up to £X, a director up to £Y, above that it goes to the CFO or the board.
Spending authority is bounded by role, and crossing a threshold requires a human higher up.

**What Mandate does.** An agent is granted authority up to a configured amount. Above it,
the purchase is **held** — all checks passed, but no card is issued until a named human
releases it.

**Why it answers the trust objection directly.** "There is no human in the loop" is only
frightening when it is unconditional. Real organisations do not give anyone unlimited
autonomy; they give bounded autonomy with an escalation path. An agent should be treated
exactly the same way.

## 3. Segregation of duties → dual control on policy changes

**The established control.** The person who performs a transaction should not also be the
person who authorises it. This is a core principle of the **COSO Internal Control —
Integrated Framework**, and internal control over financial reporting is what
**Sarbanes-Oxley section 404** requires management to assess.

**What Mandate does.** Editing the rules is the most powerful action in the system — someone
who can raise a threshold can approve anything. So a new rule version can be required to
carry a second person's approval before it becomes active.

**Why it matters here.** Without it, the honest criticism of our replay feature is: *"you can
change the rules, so the audit means nothing."* Dual control plus append-only versioning
plus the on-chain anchor together close that.

## 4. Human oversight of automated decisions → the hold, and the reasons

**The established expectations.**

- The **EU AI Act** requires that high-risk AI systems be designed so humans can oversee
  them, including the ability to intervene or interrupt. *(Human oversight is Article 14 —
  check the article number before citing it verbatim.)*
- The **NIST AI Risk Management Framework (AI 100-1)** organises AI risk work into GOVERN,
  MAP, MEASURE and MANAGE, with accountability and transparency running through all of them.
- **ISO/IEC 42001** defines a management system for AI, i.e. documented, auditable process
  rather than ad-hoc judgement.
- Long-standing data protection practice — and GDPR Article 22 specifically — treats
  *solely* automated decisions with legal or similarly significant effects as needing a
  route to human involvement.

**What Mandate does.** Three things, and each one is a design decision rather than a feature:

| Expectation | How it is met |
|---|---|
| A human can intervene | Purchases above the threshold are **held** for release |
| Decisions are explainable | Every refusal names the rule, the expected value, the actual value, and the record field it read |
| Decisions are auditable after the fact | Append-only log, with the record **snapshot** stored, so any decision can be re-judged on the facts it actually saw |
| The system is not a black box | **No model anywhere in the decision path.** The same inputs always produce the same answer |

That last row is the strongest one. Most "AI safety" claims amount to asking you to trust a
model's judgement about a model. Mandate does not ask that: **the thing making the decision
is ordinary, readable, testable code, and the AI is confined to proposing.**

## 5. Idempotency → rule 6

**The established control.** In payments, a retry is not hypothetical — it is Tuesday. A
timeout, a dropped connection or an impatient click must not produce a second charge. The
standard defence is an **idempotency key**: the same logical operation submitted twice has
the same effect as once.

**What Mandate does.** The order line *is* the key. In Postgres it is literally the primary
key of the `issued_cards` table, so a double-issue is impossible even under two concurrent
requests. Rule 6 is the legible, explainable version of a constraint the database enforces
absolutely.

---

## The trust argument, in the order it should be made

1. **"There is no human in the loop"** — there is, above a threshold you set. That is a
   delegation-of-authority matrix, the same one your company already runs for people.
2. **"How do I know the AI decided correctly?"** — the AI does not decide. It proposes.
   A deterministic rule engine decides, and you can read it.
3. **"How do I know the rules are right?"** — they are the three-way match your finance team
   already runs, moved to before the money is committed.
4. **"How do I know you did not change the rules afterwards?"** — every version is kept and
   hashed, changes can require a second approver, and the hash is anchored on-chain.
5. **"Prove it."** — change a rule and replay every past decision against it. The diff is
   only meaningful because nothing in the decision path is a model.

---

## What this is not

Mandate is **not** a compliance certification, and nothing here should be read as a claim of
conformity with any framework above. It is a hackathon build that implements the *shape* of
controls those frameworks describe. The honest claim is:

> "These are recognised controls, implemented properly, moved to the point where they
> prevent the loss instead of documenting it."
