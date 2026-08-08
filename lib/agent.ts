/**
 * The procurement agent. Takes a task, runs the negotiation, produces a PurchaseOrder.
 *
 * This is the "agent" in "agent gets a scoped virtual card." It does not decide whether the
 * purchase is allowed, that's entirely B's verify(). This function's only job is to turn a
 * task into a structured PO plus the negotiation record behind it. Keep it that way, don't
 * let approval logic creep in here.
 */

import { randomUUID } from "crypto";
import { negotiate, type NegotiationResult } from "./negotiation";
import { SELLERS_BY_TASK } from "./sellers";
import type { PurchaseOrder } from "./types";

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
    poNumber: `PO-${randomUUID().slice(0, 8).toUpperCase()}`,
    vendor: result.winner.vendor,
    sku: result.winner.sku,
    unitPrice: result.winner.unitPrice,
    quantity: task.quantity,
    quoteExpiry: expiry.toISOString().slice(0, 10),
    costCentre: task.costCentre,
  };

  return { po, negotiation: result };
}
