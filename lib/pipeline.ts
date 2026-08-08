import type {
  Approval,
  CheckResult,
  Decision,
  NegotiationSummary,
  PurchaseOrder,
} from "@/lib/types";
import { poTotal } from "@/lib/types";
import { verify } from "@/lib/checks";
import { issueCard, revokeCard } from "@/lib/rain/issuer";
import { getStore, snapshot } from "@/lib/store";

/**
 * The stages, in order, as one function.
 *
 * The shape of this file is the architecture diagram: PROPOSE, VERIFY, then ISSUE only on
 * the pass branch. There is no code path where a card is created and then judged, and no
 * path where a card outlives the obligation that justified it.
 */

export type StageName =
  | "NEGOTIATE"
  | "PROPOSE"
  | "VERIFY"
  | "HOLD"
  | "APPROVE"
  | "REFUSE"
  | "ISSUE"
  | "SETTLE"
  | "REVOKE"
  | "RECORD";

export interface Stage {
  name: StageName;
  detail: string;
  ok: boolean;
}

export interface RunResult {
  decision: Decision;
  stages: Stage[];
}

let counter = 0;
function decisionId(): string {
  counter += 1;
  return `dec_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export interface ReleaseContext {
  approval: Approval;
  releases: string;
}

export async function runPipeline(
  po: PurchaseOrder,
  agent: string,
  negotiation?: NegotiationSummary,
  release?: ReleaseContext
): Promise<RunResult> {
  const store = getStore();
  const stages: Stage[] = [];
  const total = poTotal(po);

  // 1b NEGOTIATE — already concluded upstream; recorded here so the decision keeps the
  // provenance of its own price.
  if (negotiation) {
    const won = negotiation.offers.find((o) => o.won);
    stages.push({
      name: "NEGOTIATE",
      detail: `${negotiation.offers.length} sellers bid, ${negotiation.roundCount} counter-offer round — ${won?.vendor} won at ${(( won?.final ?? 0) / 100).toFixed(2)}/unit`,
      ok: true,
    });
  }

  // 2 PROPOSE — the agent declares the PO it negotiated.
  stages.push({
    name: "PROPOSE",
    detail: `${agent} declared ${po.poNumber}: ${po.quantity} × ${po.sku} from ${po.vendor}`,
    ok: true,
  });

  // 3 VERIFY — deterministic, against a snapshot taken now and kept forever.
  const record = await snapshot(store, po, agent);
  const ruleSet = await store.latestRuleSet();

  // On a release, the delegated-limit rule has already been satisfied — by a person.
  // Every other rule still runs, against a snapshot taken now, because the world may
  // have moved while the purchase sat in the queue.
  const effective = release
    ? { ...ruleSet, rules: ruleSet.rules.filter((r) => r.id !== "requires-approval") }
    : ruleSet;

  const result = verify(po, record, effective);

  const escalated = result.failures.length === 0 && result.escalations.length > 0;

  stages.push({
    name: "VERIFY",
    detail: result.ok
      ? `All ${result.checks.filter((c) => !c.skipped).length} checks passed against policy v${ruleSet.version}`
      : escalated
        ? `All checks passed, but the amount is above the delegated limit (policy v${ruleSet.version})`
        : `${result.failures.length} of ${result.checks.length} checks failed against policy v${ruleSet.version}`,
    ok: result.ok || escalated,
  });

  const base = {
    id: decisionId(),
    createdAt: new Date().toISOString(),
    po,
    record,
    ruleVersion: ruleSet.version,
    checks: result.checks,
    agent,
    negotiation,
    ...(release ? { approval: release.approval, releases: release.releases } : {}),
  };

  // The escalation branch. Everything checked out, but the amount crossed the delegated
  // limit, so the purchase waits for a named person. Note what is missing here too: no
  // card is created while it waits, so there is nothing to claw back if it is rejected.
  if (escalated) {
    stages.push({
      name: "HOLD",
      detail: result.escalations[0].reason,
      ok: true,
    });
    const decision: Decision = { ...base, outcome: "held", card: null };
    await store.appendDecision(decision);
    stages.push({
      name: "RECORD",
      detail: `Held for release, written to the log as ${decision.id}`,
      ok: true,
    });
    return { decision, stages };
  }

  // The refusal branch. Note what is missing: any call to Rain at all.
  if (!result.ok) {
    stages.push({
      name: "REFUSE",
      detail: result.failures[0].reason,
      ok: false,
    });
    const decision: Decision = { ...base, outcome: "refused", card: null };
    await store.appendDecision(decision);
    stages.push({ name: "RECORD", detail: `Refusal written to the log as ${decision.id}`, ok: true });
    return { decision, stages };
  }

  // Reserve the order line before creating anything.
  //
  // Rule 6 is honest about what it read — it just read it a moment too early. Two
  // identical requests arriving together both snapshot before either writes, so both see
  // "no card yet" and both would issue. In payments that is not hypothetical; it is a
  // double-click, a retried webhook, two queue workers. The claim closes the window, and
  // it is what makes idempotency a property rather than a claim.
  if (!(await store.claimOrderLine(po.poNumber))) {
    const clash: CheckResult = {
      ruleId: "no-existing-card",
      label: "No card already issued for this PO",
      passed: false,
      reason: `Another request is already issuing a card for ${po.poNumber}. Exactly one card exists per order line, even when two requests arrive at the same instant.`,
      expected: "sole claim on this order line",
      actual: "another request holds it",
      readFrom: "store.claimOrderLine",
    };
    stages.push({ name: "REFUSE", detail: clash.reason, ok: false });
    const decision: Decision = {
      ...base,
      outcome: "refused",
      card: null,
      // Record what actually decided it, not the stale check that passed a moment ago.
      checks: base.checks.map((c) => (c.ruleId === clash.ruleId ? clash : c)),
    };
    await store.appendDecision(decision);
    stages.push({ name: "RECORD", detail: `Refusal written to the log as ${decision.id}`, ok: true });
    return { decision, stages };
  }

  // 4 ISSUE — a card scoped to exactly the approved amount, expiring with the quote.
  let card: Awaited<ReturnType<typeof issueCard>>;
  try {
    card = await issueCard({ po, limitCents: total });
  } catch (err) {
    // Give the line back, or a transient failure would lock it out forever.
    await store.releaseOrderLine(po.poNumber);
    throw err;
  }
  stages.push({
    name: "ISSUE",
    detail: `Card ••••${card.last4} issued, limit ${(total / 100).toFixed(2)}, expires ${card.expiresAt.slice(0, 10)}${card.simulated ? " (simulated)" : ""}`,
    ok: true,
  });

  // 5 SETTLE — and the write-back that makes the second run of this task fail on its own.
  await store.recordIssuedCard({
    cardId: card.cardId,
    poNumber: po.poNumber,
    issuedAt: new Date().toISOString(),
  });
  await store.chargeBudget(po.costCentre, total);
  await store.markFulfilled(po.poNumber);
  stages.push({
    name: "SETTLE",
    detail: `${po.costCentre} charged, ${po.poNumber} marked fulfilled`,
    ok: true,
  });

  // 7 REVOKE — the obligation is discharged, so the instrument stops existing as a live
  // thing. Everyone will demo a card being born; this is the other half, and it answers
  // "what stops the agent reusing it" without needing to argue the point.
  const revokedAt = new Date().toISOString();
  const { revoked, simulated } = await revokeCard(card.cardId);
  if (revoked) {
    await store.revokeCard(po.poNumber, revokedAt);
    stages.push({
      name: "REVOKE",
      detail: `Card ••••${card.last4} retired — it existed for exactly this purchase${simulated ? " (simulated)" : ""}`,
      ok: true,
    });
  } else {
    // Say so rather than claiming a revocation that did not happen.
    stages.push({
      name: "REVOKE",
      detail: `Could not retire card ••••${card.last4} — it is still live`,
      ok: false,
    });
  }

  // 8 RECORD — append-only, never updated in place.
  const decision: Decision = {
    ...base,
    outcome: "approved",
    card: {
      cardId: card.cardId,
      last4: card.last4,
      limitCents: card.limitCents,
      expiresAt: card.expiresAt,
    },
  };
  await store.appendDecision(decision);
  stages.push({ name: "RECORD", detail: `Decision written to the log as ${decision.id}`, ok: true });

  return { decision, stages };
}

/**
 * Release a held purchase.
 *
 * The held row is never mutated — the release is written as its own row that points back
 * at it. So the log shows both that a person was asked and that a named person answered,
 * which is the part an auditor actually wants.
 *
 * The checks are re-run against a fresh snapshot rather than trusted from the hold: the
 * world may have moved while it sat in the queue. Someone else may have bought the same
 * line, or the budget may have gone. An approval is permission to proceed, not a promise
 * that the facts still hold.
 */
export async function releaseHeld(
  decisionId: string,
  by: string,
  note: string
): Promise<RunResult> {
  const store = getStore();
  const all = await store.listDecisions();
  const held = all.find((d) => d.id === decisionId);

  if (!held) throw new Error(`No decision ${decisionId}.`);
  if (held.outcome !== "held") throw new Error(`Decision ${decisionId} is not awaiting release.`);

  // Two approvers can open the same queue. Rule 6 would catch the second release anyway —
  // it re-reads the record the first one wrote — but refusing it as a duplicate spend is
  // a confusing way to say "someone already did this", so say the clearer thing here.
  const existing = all.find((d) => d.releases === decisionId);
  if (existing) {
    throw new Error(
      `${held.po.poNumber} was already released by ${existing.approval?.by ?? "someone"}.`
    );
  }

  const stages: Stage[] = [
    {
      name: "APPROVE",
      detail: `${by} released ${held.po.poNumber}${note ? ` — "${note}"` : ""}`,
      ok: true,
    },
  ];

  const approval: Approval = {
    by,
    at: new Date().toISOString(),
    note,
    decisionId: held.id,
  };

  // Re-run the pipeline with the escalation rule lifted for this one purchase. Every
  // other rule still applies, against facts read now.
  const result = await runPipeline(held.po, held.agent, held.negotiation, {
    approval,
    releases: held.id,
  });

  return { decision: result.decision, stages: [...stages, ...result.stages] };
}
