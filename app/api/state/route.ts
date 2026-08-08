import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { anchoringEnabled } from "@/lib/monad/anchor";
import { BLANK_PO, NEGOTIATED_TASKS, TASKS } from "@/lib/fixtures/tasks";
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
    anchoringEnabled: anchoringEnabled(),
    // Deployed with no database: the log lives in serverless memory and empties on the
    // next cold start, so replay silently breaks on the exact URL we submit. It works
    // perfectly on a laptop either way, which is what makes it dangerous — so say it
    // loudly on screen rather than discovering it in front of a judge.
    ephemeralInProduction:
      store.kind === "memory" && process.env.NODE_ENV === "production",
    decisions,
    ruleSets,
    budgets: budgets.filter(Boolean),
    negotiatedTasks: NEGOTIATED_TASKS,
    tasks: TASKS,
    blankPO: BLANK_PO,
  });
}
