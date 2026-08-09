import { NextResponse } from "next/server";
import {
  COLLATERAL_CURRENCY,
  CollateralError,
  fundCollateral,
  readCollateralConfig,
  validateFundAmount,
} from "@/lib/rain/collateral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fund the team's collateral contract in Rain's sandbox.
 *
 * Sandbox only: this triggers a deposit *as if* an on-chain transfer had happened. No
 * chain transaction is executed and nothing of value moves. The response says so in its
 * own fields rather than trusting the reader to remember which environment they are in.
 *
 * Success is only ever reported when Rain returns success. Every other path — unconfigured,
 * invalid amount, Rain refusing — is its own status code with its own reason.
 */
export async function POST(request: Request) {
  let body: { amountCents?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const amount = validateFundAmount(body.amountCents);
  if (!amount.ok) return NextResponse.json({ error: amount.error }, { status: 400 });

  const config = readCollateralConfig();
  if (!config.configured) {
    return NextResponse.json(
      {
        funded: false,
        configured: false,
        environment: "rain-sandbox",
        reason: config.reason,
        needed: ["RAIN_API_KEY", "RAIN_COLLATERAL_CONTRACT_ID"],
      },
      { status: 501 }
    );
  }

  try {
    const result = await fundCollateral({
      contractId: config.contractId,
      amountCents: amount.amountCents,
    });

    return NextResponse.json({
      funded: true,
      environment: "rain-sandbox",
      note:
        "Simulated collateral deposit in Rain's sandbox. No on-chain transfer was executed " +
        "and no real value moved.",
      contractId: config.contractId,
      currency: COLLATERAL_CURRENCY,
      amountCents: amount.amountCents,
      // Empty when Rain acknowledges without a correlation id. Reported as-is rather than
      // filled in, so nobody quotes an id that does not exist.
      transactionId: result.transactionId || null,
    });
  } catch (err) {
    if (err instanceof CollateralError) {
      return NextResponse.json(
        {
          funded: false,
          environment: "rain-sandbox",
          error: "Rain rejected the sandbox collateral funding.",
          status: err.status,
          detail: err.body,
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { funded: false, error: "The sandbox funding call could not be completed." },
      { status: 500 }
    );
  }
}

/** Whether funding is switched on, without attempting it. */
export async function GET() {
  const config = readCollateralConfig();
  return NextResponse.json({
    configured: config.configured,
    environment: "rain-sandbox",
    currency: COLLATERAL_CURRENCY,
    ...(config.configured ? { contractId: config.contractId } : { reason: config.reason }),
  });
}
