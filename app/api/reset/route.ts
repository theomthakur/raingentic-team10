import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo reset. Clears cards, live decisions and any rule versions above 1, then restores
 * the fixture quotes and budgets. The seeded history survives — it is what replay reads.
 *
 * This exists so the run-it-twice moment can be rehearsed, and re-run for a second judge,
 * without redeploying.
 */
export async function POST() {
  const store = getStore();
  await store.reset();
  return NextResponse.json({ ok: true });
}
