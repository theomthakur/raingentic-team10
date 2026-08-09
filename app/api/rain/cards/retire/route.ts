import { NextResponse } from "next/server";
import {
  CARD_STATUSES,
  CardStatusError,
  RETIRED_STATUS,
  retireCard,
  validateCardId,
} from "@/lib/rain/card-retirement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Retire a scoped card once its purchase order is closed.
 *
 * `retired: true` appears only when Rain's own read-back reports the card as retired. If
 * the write is accepted and the card is still live, this answers 200 with `retired: false`
 * and the status Rain actually reports, because that is the more useful truth.
 */
export async function POST(request: Request) {
  let body: { cardId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const card = validateCardId(body.cardId);
  if (!card.ok) return NextResponse.json({ error: card.error }, { status: 400 });

  if (!process.env.RAIN_API_KEY) {
    return NextResponse.json(
      { retired: false, configured: false, reason: "RAIN_API_KEY is not set." },
      { status: 501 }
    );
  }

  try {
    const result = await retireCard(card.cardId);
    return NextResponse.json({ environment: "rain-sandbox", ...result });
  } catch (err) {
    if (err instanceof CardStatusError) {
      // 404 is worth separating: it usually means a mistyped id, not a Rain fault.
      const status = err.status === 404 ? 404 : 502;
      return NextResponse.json(
        {
          retired: false,
          cardId: card.cardId,
          error:
            err.status === 404
              ? "Rain has no card with that id."
              : "Rain rejected the retirement.",
          status: err.status,
        },
        { status }
      );
    }
    return NextResponse.json(
      { retired: false, error: "The retirement request could not be completed." },
      { status: 500 }
    );
  }
}

/**
 * What this route can do, without doing it.
 *
 * Documents where the status values came from, since `PATCH /issuing/cards/{cardId}` is
 * absent from Rain's published reference and a reader is entitled to ask.
 */
export async function GET() {
  return NextResponse.json({
    supported: true,
    environment: "rain-sandbox",
    endpoint: "PATCH /issuing/cards/{cardId}",
    retiredStatus: RETIRED_STATUS,
    acceptedStatuses: CARD_STATUSES,
    confirmedBy:
      "Rain's schema validation, probed against a non-existent card id: accepted values " +
      "return 404 (card lookup), rejected values return 400 FST_ERR_VALIDATION. Note the " +
      "spelling is \"canceled\", one L; \"cancelled\" is rejected.",
    verification: "The card is read back after the write; retired is true only if Rain reports it.",
  });
}
