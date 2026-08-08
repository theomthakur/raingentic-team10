import { NextResponse } from "next/server";
import { proposePurchase, type Task } from "@/lib/agent";
import { enrichWithLLMFlavor } from "@/lib/llm";
import { runPipeline } from "@/lib/pipeline";
import { getStore } from "@/lib/store";
import { poTotal, type QuoteRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/purchase — the join, end to end.
 *
 *   1b NEGOTIATE  competing sellers, one counter-offer round, a winner   (A)
 *   ——            the winning quote is accepted onto the record
 *   2  PROPOSE    the agent declares that quote as a PO                  (A)
 *   3  VERIFY     deterministic checks against a snapshot                (B)
 *   4  ISSUE      Rain, but only on the pass branch                      (A)
 *   5  SETTLE     charge the cost centre, write the record back          (B)
 *   6  RECORD     append-only, replayable                                (B)
 *
 * The negotiation is causally upstream rather than beside the pipeline: what it settles on
 * is what gets written to the record, and the PO the agent then declares is checked
 * against exactly that. A deviation anywhere in between is what rules 3 and 4 catch.
 *
 * Post the same task twice to see the headline refusal — the PO number is derived from the
 * task, so the second call is the same order line, and the record the first call wrote is
 * what refuses it.
 */
export async function POST(request: Request) {
  let task: Task;
  try {
    task = (await request.json()) as Task;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  // 1b NEGOTIATE, then 2 PROPOSE.
  let proposed: ReturnType<typeof proposePurchase>;
  try {
    proposed = proposePurchase(task);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }

  const { po } = proposed;

  // Optional, additive, never blocks or changes the outcome: swaps in an LLM-written
  // seller remark if GROQ_API_KEY is set and responds in time. Falls back silently to the
  // deterministic note otherwise — the price and the winner were already decided above,
  // and this runs upstream of PROPOSE, so no model is anywhere near the verify path.
  const negotiation = await enrichWithLLMFlavor(proposed.negotiation);

  // The concluded negotiation becomes an accepted order line. Without this the checker
  // would have nothing independent to compare the agent's declaration against.
  const accepted: QuoteRecord = {
    poNumber: po.poNumber,
    status: "accepted",
    fulfilled: false,
    vendor: negotiation.winner.vendor,
    sku: negotiation.winner.sku,
    unitPrice: negotiation.winner.unitPrice,
    quantity: po.quantity,
    quoteExpiry: po.quoteExpiry,
  };
  await getStore().recordAcceptedQuote(accepted);

  // 3 VERIFY onwards. Rain is only reached on the pass branch, and that is enforced by
  // the shape of runPipeline, not by a flag here.
  const { decision, stages } = await runPipeline(po, task.taskKey);

  return NextResponse.json({
    status: decision.outcome === "approved" ? "issued" : "refused",
    po,
    totalCents: poTotal(po),
    negotiation,
    decision,
    stages,
  });
}
