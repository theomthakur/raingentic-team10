import { NextResponse } from "next/server";
import { releaseHeld } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Release a held purchase.
 *
 * The approver is named and recorded. In production this is whoever the session says it
 * is; here it comes from the request, which is honest for a demo and clearly marked as
 * the thing that would be replaced by real auth.
 */
export async function POST(request: Request) {
  let body: { decisionId?: string; by?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (!body.decisionId) {
    return NextResponse.json({ error: "decisionId is required." }, { status: 400 });
  }
  if (!body.by?.trim()) {
    // An unattributed approval is not an approval. The point of the control is that a
    // named person accepted responsibility.
    return NextResponse.json({ error: "An approver name is required." }, { status: 400 });
  }

  try {
    const result = await releaseHeld(body.decisionId, body.by.trim(), body.note?.trim() ?? "");
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }
}
