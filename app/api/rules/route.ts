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
 * Editing a rule creates the next version. The version being edited is never mutated,
 * which is what keeps every decision that referenced it explicable afterwards.
 */
export async function POST(request: Request) {
  let body: { rules?: Rule[]; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.rules) || body.rules.length === 0) {
    return NextResponse.json({ error: "Provide the full rule list." }, { status: 400 });
  }

  const store = getStore();
  const previous = await store.latestRuleSet();

  // Guard against dropping or inventing rules: a version must describe the same policy
  // surface, or a replay between versions would be comparing different questions.
  const known = new Set(previous.rules.map((r) => r.id));
  const incoming = new Set(body.rules.map((r) => r.id));
  if (known.size !== incoming.size || [...known].some((id) => !incoming.has(id))) {
    return NextResponse.json(
      { error: "A new version must contain exactly the same rule ids." },
      { status: 400 }
    );
  }

  const created = await store.appendRuleSet(
    nextRuleSet(previous, body.rules, body.note ?? "")
  );

  return NextResponse.json({ ruleSet: created });
}
