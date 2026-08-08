/**
 * The procurement agent. Takes a task, runs the negotiation, produces a PurchaseOrder.
 *
 * This is the "agent" in "agent gets a scoped virtual card." It does not decide whether the
 * purchase is allowed, that's entirely B's verify(). This function's only job is to turn a
 * task into a structured PO plus the negotiation record behind it. Keep it that way, don't
 * let approval logic creep in here.
 */

import { createHash } from "crypto";
import { negotiate, type NegotiationResult } from "./negotiation";
import { SELLERS_BY_TASK } from "./sellers";
import type { PurchaseOrder } from "./types";

/**
 * The PO number is derived from the task, not random.
 *
 * A purchase order identifies an order LINE, and running the same task twice is the same
 * line, not a new one — which is exactly what rule 6 is there to catch. A fresh uuid per
 * run would make every retry look like new business and quietly defeat the idempotency
 * check, so the identity has to come from the task itself.
 */
function poNumberFor(task: Task): string {
  const key = `${task.taskKey}|${task.quantity}|${task.costCentre ?? ""}`;
  return `PO-${createHash("sha256").update(key).digest("hex").slice(0, 8).toUpperCase()}`;
}

export interface Task {
  taskKey: string; // matches a key in SELLERS_BY_TASK
  quantity: number;
  /** Cents. The buyer agent's opening ask on the counter-offer round. */
  targetPriceCents: number;
  costCentre?: string;
  /** How many days the resulting PO stays valid for issuance against. */
  validForDays?: number;
}

export interface ProposedPurchase {
  po: PurchaseOrder;
  negotiation: NegotiationResult;
}

export function proposePurchase(task: Task): ProposedPurchase {
  const sellers = SELLERS_BY_TASK[task.taskKey];
  if (!sellers?.length) throw new Error(`No sellers configured for "${task.taskKey}".`);

  const result = negotiate(
    sellers,
    task.quantity,
    task.targetPriceCents,
    sellers[0].sku,
  );

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + (task.validForDays ?? 3));

  const po: PurchaseOrder = {
    poNumber: poNumberFor(task),
    vendor: result.winner.vendor,
    sku: result.winner.sku,
    unitPrice: result.winner.unitPrice,
    quantity: task.quantity,
    // Full ISO: the checks compare this against the snapshot's observedAt, and a
    // date-only string would silently mean midnight.
    quoteExpiry: expiry.toISOString(),
    costCentre: task.costCentre ?? "CC-OPS",
  };

  return { po, negotiation: result };
}
