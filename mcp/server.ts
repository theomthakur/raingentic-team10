/**
 * Mandate as a tool any AI agent can hold.
 *
 * Everything else in this repo is a screen a person clicks. That was the hole in the
 * pitch: a spending-control layer *for agents* that no agent could actually use, where
 * the only "agent" was a deterministic function we call ourselves.
 *
 * This closes it. Point Claude, Cursor, or anything else that speaks MCP at this server
 * and it gets the same four endpoints the console uses, no privileged path, no separate
 * code, the identical eleven checks. A real model can now try to spend real money and be
 * told no, with a reason it has to reason about.
 *
 * The interesting property is not that an agent can buy things. It is that an agent that
 * *wants* to get a purchase through cannot talk its way past a pure function. Ask a
 * capable model to split a purchase to stay under the approval limit and it will try,
 * and rule 8 catches it, because the check reads the record rather than the request.
 *
 *   npm run mcp            # talks to the deployed app
 *   MANDATE_URL=http://localhost:3141 npm run mcp
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = process.env.MANDATE_URL ?? "https://raingentic-team10.vercel.app";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

interface Check {
  ruleId: string;
  label: string;
  passed: boolean;
  skipped?: boolean;
  escalates?: boolean;
  reason: string;
}
interface Decision {
  id: string;
  outcome: "approved" | "refused" | "held";
  po: { poNumber: string; vendor: string; sku: string; unitPrice: number; quantity: number; costCentre: string };
  checks: Check[];
  card?: { cardId: string; last4: string; limitCents: number } | null;
}

/**
 * The same sentence a person reads on the console.
 *
 * Deliberately verbose about *why*: an agent that is only told "denied" will retry the
 * same thing. An agent told which rule failed and what it expected can either fix the
 * purchase or explain to its user why it cannot proceed. Which is the whole point of a
 * refusal carrying a reason rather than a status code.
 */
function describe(d: Decision): string {
  const total = d.po.unitPrice * d.po.quantity;
  const lines: string[] = [
    `${d.outcome.toUpperCase()}, ${d.po.quantity} × ${d.po.sku} from ${d.po.vendor}, ${money(total)}, ${d.po.costCentre}`,
    `purchase order ${d.po.poNumber}`,
    "",
  ];

  if (d.outcome === "approved" && d.card) {
    lines.push(
      `A card was issued, scoped to this purchase: ••••${d.card.last4}, limit ${money(d.card.limitCents)}.`,
      "It is retired once the purchase settles."
    );
  } else if (d.outcome === "held") {
    const esc = d.checks.find((c) => c.escalates && !c.passed);
    lines.push(
      "No card exists. This is above the delegated limit, so a named person has to release it.",
      esc ? `Reason: ${esc.reason}` : ""
    );
  } else {
    const failed = d.checks.filter((c) => !c.passed && !c.skipped && !c.escalates);
    lines.push("No card was created. Nothing to cancel. The instrument never existed.", "");
    for (const c of failed) lines.push(`✗ ${c.label}\n  ${c.reason}`);
  }

  lines.push("", "All checks:");
  for (const c of d.checks) {
    const mark = c.skipped ? "–" : c.escalates && !c.passed ? "⏸" : c.passed ? "✓" : "✗";
    lines.push(`  ${mark} ${c.label}`);
  }
  return lines.filter(Boolean).join("\n");
}

const server = new McpServer({ name: "mandate", version: "1.0.0" });

server.registerTool(
  "list_catalogue",
  {
    title: "List what can be bought",
    description:
      "Everything available to purchase, with prices and which department budget it comes from. " +
      "Negotiated lines have no quote yet, so suppliers compete. Contract lines already have an " +
      "accepted quote, so the declared total must match it.",
    inputSchema: {},
  },
  async () => {
    const { negotiatedTasks, tasks, blankPO } = await api<{
      negotiatedTasks: { id: string; label: string; note: string; task: { taskKey: string } }[];
      tasks: { id: string; label: string; note: string; agent: string }[];
      blankPO: Record<string, unknown>;
    }>("/api/state");

    const out = [
      "NEGOTIATED: suppliers compete, the winner becomes the purchase order:",
      ...negotiatedTasks.map((t) => `  ${t.task.taskKey}, ${t.label}. ${t.note}`),
      "",
      "ON CONTRACT: a quote already exists, declare against it:",
      ...tasks.map((t) => `  ${t.id}, ${t.label}. ${t.note}`),
      "",
      "A purchase order you can edit and submit directly:",
      `  ${JSON.stringify(blankPO)}`,
    ];
    return { content: [{ type: "text", text: out.join("\n") }] };
  }
);

server.registerTool(
  "request_purchase",
  {
    title: "Ask to buy something",
    description:
      "Request a purchase. Suppliers negotiate, then the declaration is checked against the " +
      "system of record. If every check passes a scoped card is issued; if one fails no card is " +
      "created at all. Returns the outcome and the reasoning for every check.",
    inputSchema: {
      taskKey: z
        .string()
        .describe("What to buy, from list_catalogue. For example office-supplies or cloud-compute."),
      quantity: z.number().int().positive().describe("How many units."),
      costCentre: z
        .string()
        .optional()
        .describe("Which department budget pays. CC-OPS, CC-ENG, CC-FAC or CC-MKT."),
    },
  },
  async ({ taskKey, quantity, costCentre }) => {
    const { decision } = await api<{ decision: Decision }>("/api/purchase", {
      method: "POST",
      body: JSON.stringify({
        taskKey,
        quantity,
        costCentre: costCentre ?? "CC-OPS",
        targetPriceCents: 1,
        validForDays: 3,
      }),
    });
    return { content: [{ type: "text", text: describe(decision) }] };
  }
);

server.registerTool(
  "declare_purchase_order",
  {
    title: "Declare a specific purchase order",
    description:
      "Submit an exact purchase order rather than a catalogue task. This is the honest way to " +
      "attempt anything unusual: a different supplier, a different quantity, a repeat of " +
      "something already bought. Every field is checked against the record.",
    inputSchema: {
      poNumber: z.string().describe("The purchase order number on the record."),
      vendor: z.string().describe("Supplier name, exactly as quoted."),
      sku: z.string().describe("Product code, exactly as quoted."),
      unitPrice: z.number().int().describe("Price per unit, in cents."),
      quantity: z.number().int().positive(),
      costCentre: z.string().describe("CC-OPS, CC-ENG, CC-FAC or CC-MKT."),
    },
  },
  async (po) => {
    const { decision } = await api<{ decision: Decision }>("/api/run", {
      method: "POST",
      body: JSON.stringify({
        po: { ...po, quoteExpiry: new Date(Date.now() + 3 * 864e5).toISOString() },
        agent: "mcp-agent",
      }),
    });
    return { content: [{ type: "text", text: describe(decision) }] };
  }
);

server.registerTool(
  "read_decision_log",
  {
    title: "Read what has already been decided",
    description:
      "The append-only record of every purchase and why it was allowed or refused. Read this " +
      "before retrying something: a purchase already fulfilled will be refused again.",
    inputSchema: { limit: z.number().int().positive().max(50).optional() },
  },
  async ({ limit }) => {
    const { decisions } = await api<{ decisions: Decision[] }>("/api/state");
    const rows = decisions.slice(0, limit ?? 12).map((d) => {
      const total = d.po.unitPrice * d.po.quantity;
      const why = d.checks.find((c) => !c.passed && !c.skipped);
      return `${d.outcome.padEnd(8)} ${d.po.poNumber}  ${d.po.quantity} × ${d.po.sku}  ${money(total)}${why ? ` , ${why.reason}` : ""}`;
    });
    return { content: [{ type: "text", text: rows.join("\n") }] };
  }
);

// Wrapped rather than top-level await: tsx transpiles this file to CJS, where top-level
// await is not available.
async function main() {
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error("Mandate MCP server failed to start:", err);
  process.exit(1);
});
