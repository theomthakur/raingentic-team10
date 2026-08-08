import type { Decision, NegotiationSummary, PurchaseOrder } from "@/lib/types";
import { poTotal } from "@/lib/types";
import { verify } from "@/lib/checks";
import { issueCard } from "@/lib/rain/issuer";
import { getStore, snapshot } from "@/lib/store";

/**
 * The six stages, in order, as one function.
 *
 * The shape of this file is the architecture diagram: PROPOSE, VERIFY, then ISSUE only
 * on the pass branch. There is no code path where a card is created and then judged.
 */

export type StageName =
  | "NEGOTIATE"
  | "PROPOSE"
  | "VERIFY"
  | "REFUSE"
  | "ISSUE"
  | "SETTLE"
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

export async function runPipeline(
  po: PurchaseOrder,
  agent: string,
  negotiation?: NegotiationSummary
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
  const record = await snapshot(store, po);
  const ruleSet = await store.latestRuleSet();
  const result = verify(po, record, ruleSet);

  stages.push({
    name: "VERIFY",
    detail: result.ok
      ? `All ${result.checks.filter((c) => !c.skipped).length} checks passed against policy v${ruleSet.version}`
      : `${result.failures.length} of ${result.checks.length} checks failed against policy v${ruleSet.version}`,
    ok: result.ok,
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
  };

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

  // 4 ISSUE — a card scoped to exactly the approved amount, expiring with the quote.
  const card = await issueCard({ po, limitCents: total });
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

  // 6 RECORD — append-only, never updated in place.
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
