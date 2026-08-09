/**
 * Retiring a scoped card once its purchase order is closed.
 *
 * This is the closing move the product's argument needs. A card that exists for exactly one
 * purchase should stop existing when that purchase is done, otherwise "scoped authority" is
 * only a claim about the limit, not about the lifetime.
 *
 * ## How the status values were established
 *
 * Rain's published sandbox reference documents only two card endpoints, create-scoped and
 * get-by-id. `PATCH /issuing/cards/{cardId}` is undocumented, so the accepted `status`
 * values were confirmed against the API itself rather than guessed. The server validates
 * the body against a schema *before* it looks the card up, which makes the two failures
 * distinguishable:
 *
 *   invalid enum value  → 400 FST_ERR_VALIDATION "body/status must be equal to one of the
 *                             allowed values"
 *   valid enum value    → 404, because the probe used a card id that does not exist
 *
 * Probed against a deliberately non-existent card id so nothing live could be altered:
 *
 *   active canceled locked                    → 404  (accepted by the schema)
 *   inactive cancelled frozen paused expired
 *   blocked deleted pending disabled          → 400  (rejected by the schema)
 *
 * Note `canceled`, one L. `cancelled` is rejected. That single letter is the whole reason
 * this was reported as unsupported before the probe: the obvious spelling fails, and a
 * failing call is easy to misread as "the endpoint does not exist".
 *
 * ## The read-back
 *
 * `retireCard` does not report success from the PATCH response alone. It reads the card
 * back and reports the status Rain itself returns. If the write silently did nothing, the
 * read-back says so, and this function reports `retired: false` with whatever the real
 * status is. A product whose thesis is that controls should be provable cannot claim a card
 * is dead because a 200 came back.
 */

function baseUrl(): string {
  return process.env.RAIN_BASE_URL ?? "https://api-dev.raincards.xyz/v1";
}

/** The values Rain's schema accepts, confirmed by probe. */
export const CARD_STATUSES = ["active", "locked", "canceled"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

/** Terminal retirement. `locked` is the reversible freeze; this is not. */
export const RETIRED_STATUS: CardStatus = "canceled";

export class CardStatusError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown
  ) {
    super(`Rain card status error ${status}: ${JSON.stringify(body)}`);
    this.name = "CardStatusError";
  }
}

export type CardIdCheck = { ok: true; cardId: string } | { ok: false; error: string };

/**
 * Rain card ids are uuids. Checking the shape here means a typo comes back as a clear
 * message instead of an opaque 404 that reads like "already gone".
 */
export function validateCardId(input: unknown): CardIdCheck {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "cardId is required." };
  }
  const cardId = input.trim();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(cardId)) {
    return { ok: false, error: "cardId must be a uuid, as returned by card issuance." };
  }
  return { ok: true, cardId };
}

export function isCardStatus(value: unknown): value is CardStatus {
  return typeof value === "string" && (CARD_STATUSES as readonly string[]).includes(value);
}

export interface RetirementResult {
  /** True only when Rain's own read-back reports the card as retired. */
  retired: boolean;
  cardId: string;
  /** The status Rain reports after the write, not the status we asked for. */
  status: string | null;
  /** True when the card was already retired before this call. */
  alreadyRetired?: boolean;
  /** Set when the write was accepted but the card did not end up retired. */
  note?: string;
}

async function readCardStatus(cardId: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${baseUrl()}/issuing/cards/${cardId}`, {
    headers: { "content-type": "application/json", "api-key": apiKey },
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { status?: unknown } | null;
  return typeof body?.status === "string" ? body.status : null;
}

/**
 * Retire a card, then verify it.
 *
 * Throws if Rain rejects the write. Returns `retired: false` with the real status if the
 * write was accepted but the card is still live. Those are different problems and
 * collapsing them would hide the more interesting one.
 */
export async function retireCard(cardId: string): Promise<RetirementResult> {
  const apiKey = process.env.RAIN_API_KEY;
  if (!apiKey) throw new CardStatusError(0, "RAIN_API_KEY is not set.");

  const res = await fetch(`${baseUrl()}/issuing/cards/${cardId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "api-key": apiKey },
    body: JSON.stringify({ status: RETIRED_STATUS }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // Retirement is terminal: Rain answers 400 "Cannot update a canceled card" on a second
    // attempt. That is not a failure to report. The card is retired, which is what the
    // caller wanted to know. Confirmed by reading it back rather than by matching the
    // message text, so a reworded error does not turn into a false negative.
    const current = await readCardStatus(cardId, apiKey);
    if (current === RETIRED_STATUS) {
      return { retired: true, cardId, status: current, alreadyRetired: true };
    }
    throw new CardStatusError(res.status, body);
  }

  const status = await readCardStatus(cardId, apiKey);
  if (status === RETIRED_STATUS) {
    return { retired: true, cardId, status };
  }
  return {
    retired: false,
    cardId,
    status,
    note:
      status === null
        ? "Rain accepted the retirement but the card could not be read back, so it is not confirmed retired."
        : `Rain accepted the retirement but reports the card as "${status}".`,
  };
}
