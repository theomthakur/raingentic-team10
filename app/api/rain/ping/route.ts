import { NextResponse } from "next/server";
import { checkConnection, RainApiError } from "@/lib/rain-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/rain/ping: are the Rain credentials actually working?
 *
 * This used to call `getContractDetails()`, which hits `/contracts/{id}`, an endpoint
 * that returns 403 because our tenant lacks permission for user contracts, and has nothing
 * to do with whether the key works. So the health check reported a hard failure on a
 * perfectly good connection, which is exactly backwards for a health check.
 *
 * `checkConnection()` probes `/issuing/users/{id}`: the cheapest endpoint that needs auth
 * and that this account genuinely has access to. It also returns the collateral state, so
 * a red light here means the credentials are wrong, and zero contracts means the tenant
 * permission is missing, two different problems, told apart rather than conflated.
 */
export async function GET() {
  try {
    const status = await checkConnection();
    return NextResponse.json({
      ok: true,
      ...status,
      // Said plainly, because "connected" and "able to spend" are not the same thing and
      // confusing them cost hours once already.
      note:
        status.contractCount === 0
          ? "Credentials work. No collateral contract is linked, so issued cards have no spending power. That is a Rain-side permission, not a code problem."
          : "Credentials work and a collateral contract is linked.",
    });
  } catch (err) {
    if (err instanceof RainApiError) {
      return NextResponse.json(
        { ok: false, status: err.status, body: err.body },
        { status: err.status }
      );
    }
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
