/**
 * Rain sandbox payment routes: the treasury rail, kept deliberately separate from
 * supplier checkout.
 *
 * A payment route moves value between a fiat rail and an on-chain address. That is a
 * different capability from the scoped card the purchase pipeline issues, and conflating
 * the two would be dishonest in both directions: this does not pay a supplier, and a card
 * does not move treasury. Nothing here touches `lib/pipeline.ts` or the purchase flow.
 *
 * Everything is Rain's **sandbox**. No real money moves, no real bank account is debited,
 * and the transfer is triggered by a simulation endpoint rather than by an actual deposit
 * arriving. The wording in this module and in the API response says so plainly, because a
 * "global money movement" claim is exactly the kind of thing that should not be inferred
 * from a green tick.
 *
 * Configuration is explicit and never invented. Creating a route requires a destination
 * address (a real wallet on a real testnet) and this module will not make one up. Either
 * an operator supplies a route that already exists, or the feature reports itself as not
 * configured and does nothing.
 *
 * Docs: https://rain-sandbox-trial.mintlify.site/docs/payment-routes
 *       https://rain-sandbox-trial.mintlify.site/docs/simulating-transactions/transfer-transactions
 */

function baseUrl(): string {
  return process.env.RAIN_BASE_URL ?? "https://api-dev.raincards.xyz/v1";
}

/** Rain's minimum for an onramp or offramp simulation, from the transfer docs. */
export const MINIMUM_TRANSFER_USD = 2;

export class PaymentRouteError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown
  ) {
    super(`Rain payment-route error ${status}: ${JSON.stringify(body)}`);
    this.name = "PaymentRouteError";
  }
}

async function railsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.RAIN_API_KEY;
  if (!apiKey) throw new PaymentRouteError(0, "RAIN_API_KEY is not set.");

  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "api-key": apiKey,
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new PaymentRouteError(res.status, body);
  return body as T;
}

// --- configuration -----------------------------------------------------------------

/**
 * Why this is a single id rather than a wallet address in code.
 *
 * Creating a route means naming a destination, an on-chain address that belongs to
 * somebody. Hard-coding one would either be fictional, in which case the demo is a lie, or
 * real and not ours, which is worse. So the only supported path is an operator pointing at
 * a route they created themselves in the sandbox and pasting its id into the environment.
 */
export interface RailsConfig {
  paymentRouteId: string;
}

export type ConfigState =
  | { configured: true; config: RailsConfig }
  | { configured: false; reason: string };

export function readConfig(): ConfigState {
  if (!process.env.RAIN_API_KEY) {
    return { configured: false, reason: "RAIN_API_KEY is not set." };
  }

  const paymentRouteId = process.env.RAIN_PAYMENT_ROUTE_ID?.trim();
  if (!paymentRouteId) {
    return {
      configured: false,
      reason:
        "RAIN_PAYMENT_ROUTE_ID is not set. Create a payment route in the Rain sandbox " +
        "(POST /payment-routes) and set its id: this feature will not invent a destination address.",
    };
  }

  return { configured: true, config: { paymentRouteId } };
}

// --- the API shapes we actually read -------------------------------------------------

/** Only the fields we display. Rain returns more; we do not need or store the rest. */
export interface PaymentRoute {
  id: string;
  status?: string;
  source?: { currency?: string; rail?: string };
  destination?: { currency?: string; rail?: string };
}

export interface TransferSimulation {
  /**
   * Rain documents this field for accepted simulations. Sandbox responses can also be
   * asynchronous acknowledgements with no tracking fields, so callers must treat it as
   * optional rather than inventing an id.
   */
  simulationId?: string;
  /** Rain's own label, e.g. `usd_onramp` or `usd_offramp`. */
  flow?: string;
  status?: string;
  provider?: Record<string, unknown>;
}

/** Confirm the configured route exists and belongs to this tenant before simulating. */
export async function getPaymentRoute(id: string): Promise<PaymentRoute> {
  return railsFetch<PaymentRoute>(`/payment-routes/${id}`);
}

/**
 * Trigger a transfer against a configured route, exactly as if a deposit had arrived.
 *
 * `amount` is a decimal string in major units, Rain's own contract, not a convenience.
 * Cents would be wrong here, which is worth stating because everywhere else in this
 * codebase money is an integer number of cents.
 *
 * Returns 202: the simulation is accepted and processes asynchronously, so a response
 * here means "Rain took it", not "the funds have landed".
 */
export async function simulateTransfer(params: {
  paymentRouteId: string;
  amountUsd: string;
  idempotencyKey?: string;
}): Promise<TransferSimulation> {
  return railsFetch<TransferSimulation>("/simulate/payment-routes", {
    method: "POST",
    headers: params.idempotencyKey ? { "idempotency-key": params.idempotencyKey } : {},
    body: JSON.stringify({
      paymentRouteId: params.paymentRouteId,
      amount: params.amountUsd,
    }),
  });
}

// --- request validation --------------------------------------------------------------

export type AmountCheck =
  | { ok: true; amountUsd: string }
  | { ok: false; error: string };

/**
 * Validate an amount against Rain's contract before spending a network call on it.
 *
 * Rain wants `^[0-9]+(\.[0-9]+)?$` in major units with a $2 floor. Accepting a number here
 * and formatting it ourselves would quietly introduce float rounding into a money value,
 * so the string is validated as a string and passed through untouched.
 */
export function validateAmount(input: unknown): AmountCheck {
  if (typeof input !== "string" || input.trim() === "") {
    return { ok: false, error: "amountUsd must be a decimal string, for example \"25.00\"." };
  }

  const amountUsd = input.trim();
  if (!/^[0-9]+(\.[0-9]+)?$/.test(amountUsd)) {
    return {
      ok: false,
      error: "amountUsd must be a positive decimal string with no currency symbol or commas.",
    };
  }

  if (Number(amountUsd) < MINIMUM_TRANSFER_USD) {
    return {
      ok: false,
      error: `Rain requires at least $${MINIMUM_TRANSFER_USD} for a sandbox transfer simulation.`,
    };
  }

  return { ok: true, amountUsd };
}
