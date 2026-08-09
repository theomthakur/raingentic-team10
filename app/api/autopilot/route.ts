import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";
import { getStore } from "@/lib/store";
import { decideNextPurchase } from "@/lib/autopilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One tick of an agent running unattended.
 *
 * The rest of the product answers "can this purchase be trusted". This answers the
 * question underneath it: **can the agent be left alone at all.** No human types
 * anything here. The agent is given a standing objective and a budget, looks at what it
 * has already bought and what is left in each cost centre, and decides on its own what to
 * buy next — or decides to stop.
 *
 * The decision of *what* to buy is a model call and is allowed to be wrong. Whether that
 * purchase is permitted is still the eleven deterministic checks reading the system of
 * record, exactly as if a person had asked. That separation is the entire argument:
 * autonomy is safe not because the agent is good, but because being wrong is bounded.
 *
 * Returns the agent's reasoning and the chosen purchase. The client posts it to the same
 * purchase endpoints everything else uses — there is no autopilot code path through the
 * checks.
 */
export async function POST(request: Request) {
  let body: { objective?: string; alreadyBought?: string[]; sourceOnly?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const objective =
    body.objective?.trim() ||
    "Keep the office and engineering teams supplied for the week without exhausting any budget.";

  const store = getStore();
  // The customer journey can ask for a sourcing run specifically. The agent still picks
  // the category and quantity; this simply narrows its mandate to orders where supplier
  // competition is required, making the sourcing work visible instead of incidental.
  const catalog = body.sourceOnly
    ? getCatalog().filter((product) => product.kind === "negotiated")
    : getCatalog();
  const budgets = await Promise.all(
    ["CC-OPS", "CC-ENG", "CC-FAC", "CC-MKT"].map((c) => store.getBudget(c))
  );

  const next = await decideNextPurchase({
    objective,
    catalog,
    budgets: budgets.filter(Boolean) as { costCentre: string; limitCents: number; spentCents: number }[],
    alreadyBought: body.alreadyBought ?? [],
  });

  if (!next) {
    return NextResponse.json({
      done: true,
      reasoning: "Nothing further is worth buying against this objective right now.",
    });
  }

  return NextResponse.json({ done: false, ...next });
}
