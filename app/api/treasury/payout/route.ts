import { NextResponse } from "next/server";
import { PaymentRouteError, readConfig } from "@/lib/rain/payment-routes";
import {
  MINIMUM_TRANSFER_USD,
  SANDBOX_DISCLAIMER,
  requestPayout,
  validatePayoutRequest,
} from "@/lib/rain/treasury";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIND = "Conditional treasury payout (Rain sandbox payment route)";

/**
 * Move treasury along the configured Rain payment route, but only against a stated rule.
 *
 * Separate from supplier checkout by design. A supplier is paid by a scoped card bound to a
 * verified purchase order; this moves treasury. The two share no code and appear in no
 * shared response, because showing one as the other would be a fake checkout.
 *
 * The payout is conditional in a way that survives inspection: `policyRef` and `purpose` are
 * required, they are hashed into an authorization digest before the rail is touched, and the
 * digest is both the idempotency key sent to Rain and part of the evidence returned. A
 * reader can recompute it from the `canonical` string in the response.
 *
 * Status codes are the honest ones. 400 for a request that fails validation, 501 when the
 * rail is not configured, 502 when Rain refuses. The success body says `accepted`, never
 * settled.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  // Validated before configuration is read, so a malformed request gets the same clear
  // answer whether or not the rail happens to be switched on in this environment.
  const check = validatePayoutRequest(body);
  if (!check.ok) {
    return NextResponse.json(
      { accepted: false, environment: "rain-sandbox", error: check.error },
      { status: 400 }
    );
  }

  try {
    const outcome = await requestPayout(check.request);

    if (!outcome.configured) {
      // 501, not a cheerful 200. The endpoint is understood and correct; the capability is
      // simply not switched on here, and nothing was attempted.
      return NextResponse.json(
        {
          accepted: false,
          configured: false,
          environment: "rain-sandbox",
          kind: KIND,
          reason: outcome.reason,
          needed: ["RAIN_API_KEY", "RAIN_PAYMENT_ROUTE_ID"],
        },
        { status: 501 }
      );
    }

    return NextResponse.json({
      accepted: true,
      configured: true,
      kind: KIND,
      ...outcome.result,
    });
  } catch (err) {
    if (err instanceof PaymentRouteError) {
      return NextResponse.json(
        {
          accepted: false,
          configured: true,
          environment: "rain-sandbox",
          kind: KIND,
          error: "Rain rejected the sandbox payout. Nothing was accepted.",
          status: err.status,
          detail: err.body,
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      {
        accepted: false,
        environment: "rain-sandbox",
        error: "The sandbox payout could not be attempted.",
      },
      { status: 500 }
    );
  }
}

/**
 * Whether the rail is configured, without touching it.
 *
 * Also states the contract, so a caller learns the required fields without having to fail a
 * request first.
 */
export async function GET() {
  const state = readConfig();
  return NextResponse.json({
    configured: state.configured,
    environment: "rain-sandbox",
    kind: KIND,
    disclaimer: SANDBOX_DISCLAIMER,
    requires: {
      amountUsd: `Decimal string in major units, minimum ${MINIMUM_TRANSFER_USD}. No symbols or commas.`,
      purpose: "Short description of what the payout is for.",
      policyRef: "Identifier of the rule that authorises it, e.g. \"treasury.rebalance.v2\".",
    },
    ...(state.configured ? {} : { reason: state.reason, needed: ["RAIN_API_KEY", "RAIN_PAYMENT_ROUTE_ID"] }),
  });
}
