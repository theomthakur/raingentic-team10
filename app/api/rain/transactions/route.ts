import { NextResponse } from "next/server";
import { TransactionsError, listTransactions, validateLimit } from "@/lib/rain/transactions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only view of Rain issuing transactions.
 *
 * GET only. There is no POST, PATCH or DELETE here by design, this route can show what
 * happened on the cards and cannot change any of it.
 *
 * The rows are the projection from `lib/rain/transactions`, so no card number, CVC,
 * cardholder name or email reaches the browser even though Rain includes some of those in
 * its own response.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("limit");
  const limit = validateLimit(raw);
  if (!limit.ok) return NextResponse.json({ error: limit.error }, { status: 400 });

  if (!process.env.RAIN_API_KEY) {
    return NextResponse.json(
      {
        configured: false,
        transactions: [],
        reason: "RAIN_API_KEY is not set, so there is no account to read transactions from.",
      },
      { status: 501 }
    );
  }

  try {
    const transactions = await listTransactions(limit.limit);
    return NextResponse.json({
      configured: true,
      environment: "rain-sandbox",
      limit: limit.limit,
      count: transactions.length,
      transactions,
    });
  } catch (err) {
    if (err instanceof TransactionsError) {
      return NextResponse.json(
        {
          error: "Rain rejected the transactions request.",
          status: err.status,
          transactions: [],
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "The transactions request could not be completed.", transactions: [] },
      { status: 500 }
    );
  }
}
