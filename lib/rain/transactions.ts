/**
 * Reading what actually happened on the cards.
 *
 * `GET /issuing/transactions` is the other half of the issuance story: the app can say a
 * card was created for exactly one purchase, and this is where you check whether anything
 * was ever authorised against it. Read-only by construction — nothing in this module can
 * move, hold, or refund money.
 *
 * **The projection is the point.** Rain's transaction objects carry cardholder personal
 * data — `userFirstName`, `userEmail` — alongside the merchant and amount fields. None of
 * that is needed to show what a card did, so none of it leaves this module. A product
 * whose argument is "bound authority, nothing more than required" cannot then hand a
 * browser a payload of names and email addresses because they happened to be in the
 * response.
 *
 * Docs: https://rain-sandbox-trial.mintlify.site/reference/transactions/get-all-transactions
 */

function baseUrl(): string {
  return process.env.RAIN_BASE_URL ?? "https://api-dev.raincards.xyz/v1";
}

/** Rain's own bounds on the `limit` query parameter. */
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;

export class TransactionsError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown
  ) {
    super(`Rain transactions error ${status}: ${JSON.stringify(body)}`);
    this.name = "TransactionsError";
  }
}

/**
 * What we are willing to show. Deliberately a subset, and deliberately not extensible by
 * accident — anything new has to be added here on purpose, having been looked at.
 */
export interface SafeTransaction {
  id: string;
  type: string;
  /** Cents, as Rain reports it. */
  amountCents: number | null;
  currency: string | null;
  merchantName: string | null;
  merchantCategory: string | null;
  status: string | null;
  authorizedAt: string | null;
  /** Which card it hit, so a transaction can be tied to an issued card. */
  cardId: string | null;
}

export type LimitCheck = { ok: true; limit: number } | { ok: false; error: string };

export function validateLimit(input: unknown): LimitCheck {
  if (input === undefined || input === null || input === "") {
    return { ok: true, limit: DEFAULT_LIMIT };
  }
  const limit = typeof input === "string" ? Number(input) : input;
  if (typeof limit !== "number" || !Number.isFinite(limit) || !Number.isInteger(limit)) {
    return { ok: false, error: "limit must be a whole number." };
  }
  if (limit < 1 || limit > MAX_LIMIT) {
    return { ok: false, error: `limit must be between 1 and ${MAX_LIMIT}.` };
  }
  return { ok: true, limit };
}

/**
 * Trimmed on the way out. Card networks pad merchant names to a fixed width, so Rain
 * returns things like `"Staples Business         "` — real data, badly shaped for display.
 */
const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed ? trimmed : null;
};
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Narrow one Rain transaction to the fields above.
 *
 * The response is a `oneOf` keyed on `type`, and only `spend` carries merchant detail, so
 * the shared fields are read defensively rather than assumed. Anything unrecognised still
 * produces a row with an id and a type instead of being dropped — a transaction we cannot
 * fully parse is still a transaction that happened, and hiding it would make the list
 * quietly wrong.
 */
export function toSafeTransaction(raw: unknown): SafeTransaction | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const id = str(t.id);
  if (!id) return null;

  const detail = (t.spend ?? t.collateral ?? t.transfer ?? t.payment ?? t.fee) as
    | Record<string, unknown>
    | undefined;
  const d = detail && typeof detail === "object" ? detail : {};

  return {
    id,
    type: str(t.type) ?? "unknown",
    amountCents: num(d.amount),
    currency: str(d.currency),
    merchantName: str(d.merchantName),
    merchantCategory: str(d.merchantCategory),
    status: str(d.status),
    authorizedAt: str(d.authorizedAt) ?? str(d.createdAt),
    cardId: str(d.cardId),
    // Intentionally absent: userFirstName, userEmail, userId, receipt, and anything else
    // identifying. See the note at the top of this file.
  };
}

export async function listTransactions(limit = DEFAULT_LIMIT): Promise<SafeTransaction[]> {
  const apiKey = process.env.RAIN_API_KEY;
  if (!apiKey) throw new TransactionsError(0, "RAIN_API_KEY is not set.");

  const res = await fetch(`${baseUrl()}/issuing/transactions?limit=${limit}`, {
    headers: { "content-type": "application/json", "api-key": apiKey },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new TransactionsError(res.status, body);

  // Rain has returned both a bare array and a `{ data: [...] }` envelope across endpoints,
  // so accept either rather than guessing wrong and rendering an empty list.
  const rows: unknown[] = Array.isArray(body)
    ? body
    : Array.isArray((body as { data?: unknown[] } | null)?.data)
      ? ((body as { data: unknown[] }).data)
      : Array.isArray((body as { transactions?: unknown[] } | null)?.transactions)
        ? ((body as { transactions: unknown[] }).transactions)
        : [];

  return rows.map(toSafeTransaction).filter((t): t is SafeTransaction => t !== null);
}
