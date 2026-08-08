import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { TASKS } from "@/lib/fixtures/tasks";
import { COST_CENTRES } from "@/lib/fixtures/records";

// node runtime: the rule hash uses node:crypto, and the Postgres driver expects it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything the UI needs in one round trip. */
export async function GET() {
  const store = getStore();
  const [decisions, ruleSets] = await Promise.all([
    store.listDecisions(),
    store.listRuleSets(),
  ]);

  const budgets = await Promise.all(COST_CENTRES.map((c) => store.getBudget(c)));

  return NextResponse.json({
    storage: store.kind,
    rainWired: Boolean(process.env.RAIN_API_KEY),
    decisions,
    ruleSets,
    budgets: budgets.filter(Boolean),
    tasks: TASKS,
  });
}
