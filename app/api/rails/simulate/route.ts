import { NextResponse } from "next/server";
import {
  PaymentRouteError,
  getPaymentRoute,
  readConfig,
  simulateTransfer,
  validateAmount,
} from "@/lib/rain/payment-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trigger a sandbox fiat-to-crypto payment route transfer.
 *
 * This is evidence of the wider Rain rails, and deliberately **not** part of supplier
 * checkout. A purchase issues a scoped card against a verified purchase order; this moves
 * value along a configured route. Presenting one as the other would be a fake checkout,
 * so they share no code and no wording.
 *
 * Everything here is Rain's sandbox. Nothing is settled, no bank account is debited, and
 * the transfer is triggered by a simulation endpoint rather than a deposit actually
 * arriving. The response says so in its own fields rather than relying on the caller to
 * remember.
 *
 * Unconfigured is reported as unconfigured. The one thing this must never do is return a
 * cheerful success for a transfer that did not happen.
 */
export async function POST(request: Request) {
  let body: { amountUsd?: unknown; reference?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const amount = validateAmount(body.amountUsd);
  if (!amount.ok) {
    return NextResponse.json({ error: amount.error }, { status: 400 });
  }

  const state = readConfig();
  if (!state.configured) {
    // 501, not 200-with-a-sad-face and not 500: the endpoint is understood and correct,
    // the capability simply is not switched on in this environment.
    return NextResponse.json(
      {
        configured: false,
        environment: "rain-sandbox",
        reason: state.reason,
        needed: ["RAIN_API_KEY", "RAIN_PAYMENT_ROUTE_ID"],
      },
      { status: 501 }
    );
  }

  const { paymentRouteId } = state.config;

  try {
    // Read the route first. It confirms the id belongs to this tenant and gives us the
    // real currencies and rails to display, rather than us asserting what they are.
    const route = await getPaymentRoute(paymentRouteId);

    const simulation = await simulateTransfer({
      paymentRouteId,
      amountUsd: amount.amountUsd,
      idempotencyKey: typeof body.reference === "string" ? body.reference.slice(0, 64) : undefined,
    });

    return NextResponse.json({
      configured: true,
      environment: "rain-sandbox",
      kind: "Sandbox fiat-to-crypto payment route",
      note:
        "Simulated transfer in Rain's sandbox. No real funds move and no bank account is " +
        "debited. Separate from supplier checkout, which issues a scoped card instead.",
      route: {
        id: route.id,
        status: route.status ?? null,
        source: route.source ?? null,
        destination: route.destination ?? null,
      },
      transfer: {
        simulationId: simulation.simulationId,
        flow: simulation.flow ?? null,
        // Rain returns 202: accepted and processing, which is not the same as settled.
        status: simulation.status ?? "accepted",
        amountUsd: amount.amountUsd,
      },
    });
  } catch (err) {
    if (err instanceof PaymentRouteError) {
      return NextResponse.json(
        {
          configured: true,
          environment: "rain-sandbox",
          error: "Rain rejected the sandbox transfer.",
          status: err.status,
          detail: err.body,
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "The sandbox transfer could not be attempted." },
      { status: 500 }
    );
  }
}

/** Whether the rail is switched on, for a UI that wants to know before offering it. */
export async function GET() {
  const state = readConfig();
  return NextResponse.json({
    configured: state.configured,
    environment: "rain-sandbox",
    kind: "Sandbox fiat-to-crypto payment route",
    ...(state.configured ? {} : { reason: state.reason }),
  });
}
