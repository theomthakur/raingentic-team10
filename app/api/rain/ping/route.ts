import { NextResponse } from "next/server";
import { getContractDetails, RainApiError } from "@/lib/rain-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/rain/ping — the 13:00-15:00 milestone. One successful authenticated call.
 * Nothing else in the plan matters until this returns 200.
 */
export async function GET() {
  try {
    const contract = await getContractDetails();
    return NextResponse.json({ ok: true, contract });
  } catch (err) {
    if (err instanceof RainApiError) {
      return NextResponse.json(
        { ok: false, status: err.status, body: err.body },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
