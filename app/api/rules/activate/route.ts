import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { activateRuleSet } from "@/lib/rules/defaults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Activate a pending policy version: the second half of dual control.
 *
 * The author may not approve their own change. That refusal is the entire value of the
 * control, so it is enforced in `activateRuleSet` rather than being a UI convention that
 * a direct API call could walk around.
 */
export async function POST(request: Request) {
  let body: { version?: number; approvedBy?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (typeof body.version !== "number") {
    return NextResponse.json({ error: "version is required." }, { status: 400 });
  }
  if (!body.approvedBy?.trim()) {
    return NextResponse.json({ error: "An approver name is required." }, { status: 400 });
  }

  const store = getStore();
  const pending = await store.getRuleSet(body.version);
  if (!pending) {
    return NextResponse.json({ error: `No policy v${body.version}.` }, { status: 404 });
  }

  try {
    const activated = activateRuleSet(pending, body.approvedBy);
    await store.activateRuleSet(activated);
    return NextResponse.json({ ruleSet: activated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
}
