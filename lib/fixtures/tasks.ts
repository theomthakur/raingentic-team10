import type { PurchaseOrder } from "@/lib/types";
import { PO_COST_CENTRE, SEED_QUOTES } from "./records";

/**
 * Runnable demo tasks.
 *
 * In the joined build these POs come from A's agent. Until then these stand in, and they
 * are deliberately not a gallery of scripted failures — the first one is an ordinary,
 * correct purchase. The headline refusal in the demo comes from running that same task a
 * second time, not from a task written to fail.
 */
export interface Task {
  id: string;
  label: string;
  agent: string;
  note: string;
  po: PurchaseOrder;
}

function fromQuote(poNumber: string, overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  const q = SEED_QUOTES.find((x) => x.poNumber === poNumber);
  if (!q) throw new Error(`no seeded quote ${poNumber}`);
  return {
    poNumber: q.poNumber,
    vendor: q.vendor,
    sku: q.sku,
    unitPrice: q.unitPrice,
    quantity: q.quantity,
    quoteExpiry: q.quoteExpiry,
    costCentre: PO_COST_CENTRE[q.poNumber] ?? "CC-OPS",
    ...overrides,
  };
}

export const TASKS: Task[] = [
  {
    id: "restock-brackets",
    label: "Restock mounting brackets",
    agent: "procurement-01",
    note: "An ordinary, correct purchase. Run it once — then run it again.",
    po: fromQuote("PO-4417"),
  },
  {
    id: "sensor-batch",
    label: "Order sensor batch for line 3",
    agent: "procurement-02",
    note: "Also correct. A second clean run so the feed is not one row.",
    po: fromQuote("PO-4418"),
  },
  {
    id: "chairs-wrong-vendor",
    label: "Buy replacement chairs",
    agent: "facilities-01",
    note: "Right item, right price, a vendor that never quoted it.",
    po: fromQuote("PO-4421", { vendor: "Halloway Trading" }),
  },
  {
    id: "freight-wrong-sku",
    label: "Book EU freight lane",
    agent: "procurement-01",
    note: "Right vendor, right total, wrong line item. No card control can see this.",
    po: fromQuote("PO-4422", { sku: "PL-FRT-EU4" }),
  },
];
