import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { replay } from "@/lib/replay";
import { hashRules } from "@/lib/rules/hash";
import type { Rule, RuleSet } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Replay the whole decision log against a rule version.
 *
 * Two modes, and the difference matters for the demo. Pass a `version` to replay against
 * a version that was actually committed. Pass `rules` to preview an edit that has not
 * been saved yet — a dry run, so a finance team can see what a change would do to history
 * before committing to it.
 */
export async function POST(request: Request) {
  let body: { version?: number; rules?: Rule[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const store = getStore();
  const decisions = await store.listDecisions();

  let target: RuleSet;

  if (Array.isArray(body.rules)) {
    const previous = await store.latestRuleSet();
    target = {
      version: previous.version + 1,
      createdAt: new Date().toISOString(),
      note: "Unsaved preview",
      rules: body.rules,
      hash: hashRules(body.rules),
    };
  } else if (typeof body.version === "number") {
    const found = await store.getRuleSet(body.version);
    if (!found) {
      return NextResponse.json({ error: `No rule version ${body.version}.` }, { status: 404 });
    }
    target = found;
  } else {
    return NextResponse.json({ error: "Provide a version or a rules array." }, { status: 400 });
  }

  return NextResponse.json({ result: replay(decisions, target), target });
}
