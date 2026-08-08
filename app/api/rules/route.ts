import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { nextRuleSet } from "@/lib/rules/defaults";
import type { Rule } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = getStore();
  return NextResponse.json({ ruleSets: await store.listRuleSets() });
}

/**
 * Propose a policy change.
 *
 * Editing a rule creates the next version — the version being edited is never mutated,
 * which is what keeps every decision that referenced it explicable afterwards. The new
 * version is written as **pending**: it decides nothing until a second person activates
 * it, because whoever can raise a threshold can otherwise approve anything.
 */
export async function POST(request: Request) {
  let body: { rules?: Rule[]; note?: string; proposedBy?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.rules) || body.rules.length === 0) {
    return NextResponse.json({ error: "Provide the full rule list." }, { status: 400 });
  }
  if (!body.proposedBy?.trim()) {
    return NextResponse.json(
      { error: "A proposer name is required — an unattributed policy change is not auditable." },
      { status: 400 }
    );
  }

  const store = getStore();
  const all = await store.listRuleSets();
  const active = await store.latestRuleSet();

  // One pending change at a time. Two competing drafts would make "which policy is next"
  // ambiguous, and the whole point of this is that the answer is never ambiguous.
  const pending = all.find((r) => r.status === "pending");
  if (pending) {
    return NextResponse.json(
      {
        error: `Policy v${pending.version} is already proposed by ${pending.proposedBy} and waiting for approval.`,
      },
      { status: 409 }
    );
  }

  // A version must describe the same policy surface, or a replay between versions would
  // be comparing different questions.
  const known = new Set(active.rules.map((r) => r.id));
  const incoming = new Set(body.rules.map((r) => r.id));
  if (known.size !== incoming.size || [...known].some((id) => !incoming.has(id))) {
    return NextResponse.json(
      { error: "A new version must contain exactly the same rule ids." },
      { status: 400 }
    );
  }

  const highest = all.reduce((a, b) => (b.version > a.version ? b : a), active);
  const created = await store.appendRuleSet(
    nextRuleSet(highest, body.rules, body.note ?? "", body.proposedBy.trim())
  );

  return NextResponse.json({ ruleSet: created });
}
