import { NextResponse } from "next/server";
import { proposePurchase, type Task } from "@/lib/agent";
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
  try {
    po = proposePurchase(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }

  const check = await verifyStub(po);
  if (!check.ok) {
    return NextResponse.json({ po, status: "refused", failures: check.failures }, { status: 200 });
  }

  try {
    const card = await issueScopedCard({
      limitCents: po.unitPrice * po.quantity,
      expiresAt: po.quoteExpiry,
      reference: po.poNumber,
    });
    return NextResponse.json({ po, status: "issued", card });
  } catch (err) {
    if (err instanceof RainApiError) {
      return NextResponse.json(
        { po, status: "rain_error", detail: err.body },
        { status: err.status },
      );
    }
    return NextResponse.json({ po, status: "error", error: (err as Error).message }, { status: 500 });
  }
}
