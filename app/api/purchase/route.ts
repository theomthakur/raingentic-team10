import { NextResponse } from "next/server";
import { proposePurchase, type Task } from "@/lib/agent";
import { enrichWithLLMFlavor } from "@/lib/llm";
import { issueScopedCard, RainApiError } from "@/lib/rain-client";
import type { CheckResult, PurchaseOrder } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/purchase — the 17:00 join.
 *
 * 1. The agent proposes a PO (this file, A's side).
 * 2. B's verify() checks it. TODO(B): replace the stub below with the real import once
 *    lib/verify.ts exists, e.g. `import { verify } from "@/lib/verify"`.
 * 3. Pass -> issue a real scoped card. Fail -> no Rain call happens at all, the refusal
 *    reason is what gets returned.
 *
 * Run the SAME task twice to exercise the idempotency check (rule 6) once it's wired,
 * that's the run-it-twice demo moment: identical input, second call refused because the
 * first call's own record now exists.
 */

// TODO(B): delete this stub the moment lib/verify.ts exists and import the real thing.
async function verifyStub(po: PurchaseOrder): Promise<CheckResult> {
  return { ok: true, failures: [] };
}

export async function POST(request: Request) {
  const body = (await request.json()) as Task;

  let po: PurchaseOrder;
  let negotiation: Awaited<ReturnType<typeof proposePurchase>>["negotiation"];
  try {
    ({ po, negotiation } = proposePurchase(body));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }

  // Optional, additive, never blocks or changes the outcome: swaps in an LLM-written
  // seller remark if GROQ_API_KEY is set and responds in time. Falls back silently to the
  // deterministic note otherwise, the price and the winner were already decided above.
  negotiation = await enrichWithLLMFlavor(negotiation);

  const check = await verifyStub(po);
  if (!check.ok) {
    return NextResponse.json(
      { po, negotiation, status: "refused", failures: check.failures },
      { status: 200 },
    );
  }

  try {
    const card = await issueScopedCard({
      limitCents: po.unitPrice * po.quantity,
      expiresAt: po.quoteExpiry,
      reference: po.poNumber,
    });
    return NextResponse.json({ po, negotiation, status: "issued", card });
  } catch (err) {
    if (err instanceof RainApiError) {
      return NextResponse.json(
        { po, negotiation, status: "rain_error", detail: err.body },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { po, negotiation, status: "error", error: (err as Error).message },
      { status: 500 },
    );
  }
}
