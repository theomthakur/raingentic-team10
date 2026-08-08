import type { PurchaseOrder } from "@/lib/types";
import type { Task as AgentTask } from "@/lib/agent";
import { PO_COST_CENTRE, SEED_QUOTES } from "./records";

/**
 * Tasks that go through the full negotiation before anything is declared.
 *
 * These are the primary demo path: sellers compete, one wins, and the winner's number is
 * what the checks then verify. Running the same one twice is the headline refusal.
 */
export interface NegotiatedTask {
  id: string;
  label: string;
  note: string;
  task: AgentTask;
}

export const NEGOTIATED_TASKS: NegotiatedTask[] = [
  {
    id: "restock-office",
    label: "Restock office supplies",
    note: "Four sellers bid, one counter-offer round. Run it once — then run it again.",
    task: {
      taskKey: "office-supplies",
      quantity: 10,
      targetPriceCents: 4_000,
      costCentre: "CC-OPS",
      validForDays: 5,
    },
  },
  {
    id: "gpu-compute",
    label: "Provision GPU compute for training",
    note: "Three sellers, tighter market. A second clean run so the feed is not one row.",
    task: {
      taskKey: "cloud-compute",
      quantity: 4,
      targetPriceCents: 11_000,
      costCentre: "CC-ENG",
      validForDays: 2,
    },
  },
];

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

/**
 * Direct purchase orders against a pre-existing quote — no negotiation.
 *
 * These are the deviation scenarios. They exist to show a specific rule catching a
 * specific thing, so each one is built to fail on exactly one rule and no others.
 */
export const TASKS: Task[] = [
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
  {
    id: "conveyor-capital",
    label: "Order conveyor line for the new bay",
    agent: "procurement-02",
    note: "Nothing wrong with it — just $43,500. Held for a person, not refused.",
    po: fromQuote("PO-4423"),
  },
];

/** A correct PO, used to prefill the hand-written form so it starts from something that
 *  passes and a judge has to actively break it. */
export const BLANK_PO: PurchaseOrder = fromQuote("PO-4418");
