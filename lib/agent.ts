/**
 * The procurement agent. Takes a task, gets the winning quote, produces a PurchaseOrder.
 *
 * This is the "agent" in "agent gets a scoped virtual card." It does not decide whether the
 * purchase is allowed, that's entirely B's verify(). This function's only job is to turn a
 * task into a structured PO. Keep it that way, don't let approval logic creep in here.
 */

import { randomUUID } from "crypto";
import { selectQuote } from "./quotes";
import type { PurchaseOrder } from "./types";

export interface Task {
  taskKey: string; // matches a key in SAMPLE_QUOTES
  quantity: number;
  costCentre?: string;
  /** How many days the resulting PO stays valid for issuance against. */
  validForDays?: number;
}

export function proposePurchase(task: Task): PurchaseOrder {
  const quote = selectQuote(task.taskKey, task.quantity);

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + (task.validForDays ?? 3));

  return {
    poNumber: `PO-${randomUUID().slice(0, 8).toUpperCase()}`,
    vendor: quote.vendor,
    sku: quote.sku,
    unitPrice: quote.unitPrice,
    quantity: task.quantity,
    quoteExpiry: expiry.toISOString().slice(0, 10),
    costCentre: task.costCentre,
  };
}
