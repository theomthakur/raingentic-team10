import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo reset. Clears cards, live decisions and any rule versions above 1, then restores
 * the fixture quotes and budgets. The seeded history survives, it is what replay reads.
 *
 * This exists so the run-it-twice moment can be rehearsed, and re-run for a second judge,
 * without redeploying.
 *
 * 🔴 It is also the one destructive endpoint on a public URL, and it used to take no
 * credential at all: anyone who found the address could wipe the live demo state mid-
 * judging with a single POST. Every other route only adds rows; this one removes them.
 *
 * So it now requires a token when `DEMO_RESET_TOKEN` is set, which it is in production.
 * Left unset (as it is locally) the route stays open, so development is unaffected.
 *
 * This is deliberately not presented as authentication. It is a lock on the one door that
 * destroys data. The approval and policy routes remain open by design, because a judge has
 * to be able to use them, and they only ever append.
 */
export async function POST(request: Request) {
  const required = process.env.DEMO_RESET_TOKEN;

  if (required) {
    const supplied = request.headers.get("x-demo-token");
    if (supplied !== required) {
      return NextResponse.json(
        { error: "Reset needs the demo token. Set it once from the console." },
        { status: 401 }
      );
    }
  }

  const store = getStore();
  await store.reset();
  return NextResponse.json({ ok: true });
}
