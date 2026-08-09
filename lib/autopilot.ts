import type { CatalogProduct } from "./catalog";

/**
 * The agent deciding for itself what to buy next.
 *
 * Everything else in this codebase is about whether a purchase should be allowed. This is
 * the part that makes the question worth asking: an agent with a standing objective and a
 * budget, choosing its own next move with nobody typing anything.
 *
 * Two properties matter and they pull in opposite directions, deliberately:
 *
 *  1. The choice is genuinely the model's. It sees the objective, the catalogue, what is
 *     left in each budget and what it has already bought this run, and it picks. It is
 *     allowed to pick badly.
 *  2. Being wrong is bounded. Whatever it picks goes through the same eleven deterministic
 *     checks as a purchase a person asked for. There is no autopilot path around them.
 *
 * That is the whole argument for autonomy: it is safe because a bad decision cannot become
 * a bad payment, not because the agent is trusted to be right.
 */

export interface AutopilotChoice {
  productId: string;
  quantity: number;
  /** Why the agent chose this, in its own words. Shown on screen as it runs. */
  reasoning: string;
}

interface Budget {
  costCentre: string;
  limitCents: number;
  spentCents: number;
}

function groqKey(): string | undefined {
  return process.env.GROQ_API_KEY ?? process.env.GROQ_KEY;
}

const MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
const TIMEOUT_MS = 8000;

/**
 * Without a model, the agent still runs — it just reasons arithmetically instead.
 *
 * Worth keeping rather than failing closed: the point being demonstrated is unattended
 * spending inside limits, and that holds whether the chooser is a language model or a
 * rule. The UI says which one is driving.
 */
function chooseWithoutModel(
  catalog: CatalogProduct[],
  budgets: Budget[],
  alreadyBought: string[]
): AutopilotChoice | null {
  const room = new Map(budgets.map((b) => [b.costCentre, b.limitCents - b.spentCents]));
  const candidate = catalog
    .filter((p) => !alreadyBought.includes(p.id) && !p.alreadyFulfilled)
    .find((p) => (room.get(p.costCentre) ?? 0) > p.fromCents * 2);
  if (!candidate) return null;
  return {
    productId: candidate.id,
    quantity: candidate.quotedQuantity ?? 2,
    reasoning: `${candidate.costCentre} has room, and ${candidate.name} has not been ordered this run.`,
  };
}

export async function decideNextPurchase({
  objective,
  catalog,
  budgets,
  alreadyBought,
}: {
  objective: string;
  catalog: CatalogProduct[];
  budgets: Budget[];
  alreadyBought: string[];
}): Promise<AutopilotChoice | null> {
  const apiKey = groqKey();
  if (!apiKey) return chooseWithoutModel(catalog, budgets, alreadyBought);

  const menu = catalog
    .filter((p) => !alreadyBought.includes(p.id))
    .map(
      (p) =>
        `${p.id} = ${p.name}, ${(p.fromCents / 100).toFixed(2)} per ${p.unit}, paid from ${p.costCentre}`
    )
    .join("\n");

  if (!menu) return null;

  const budgetLines = budgets
    .map(
      (b) =>
        `${b.costCentre}: ${((b.limitCents - b.spentCents) / 100).toFixed(2)} remaining of ${(b.limitCents / 100).toFixed(2)}`
    )
    .join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 160,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a procurement agent buying on a company's behalf, unattended.\n" +
              "Choose the single next purchase that best serves the objective.\n" +
              'Reply with JSON only: {"productId": string, "quantity": integer, "reasoning": string}.\n' +
              "productId MUST be one of the listed ids. Never invent one.\n" +
              "quantity is a positive integer. Keep it proportionate to the budget remaining.\n" +
              "reasoning is one sentence, under 20 words, explaining why this and why now.\n" +
              'If nothing is worth buying, reply {"productId": "none", "quantity": 0, "reasoning": "..."}.',
          },
          {
            role: "user",
            content: `Objective: ${objective}\n\nBudgets:\n${budgetLines}\n\nAvailable:\n${menu}\n\nAlready bought this run: ${alreadyBought.join(", ") || "nothing yet"}`,
          },
        ],
      }),
    });

    if (!res.ok) return chooseWithoutModel(catalog, budgets, alreadyBought);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) return chooseWithoutModel(catalog, budgets, alreadyBought);

    const parsed = JSON.parse(raw) as Partial<AutopilotChoice>;
    const product = catalog.find((p) => p.id === parsed.productId);
    const quantity = Number(parsed.quantity);
    if (!product || !Number.isFinite(quantity) || quantity <= 0) return null;

    return {
      productId: product.id,
      quantity: Math.floor(quantity),
      reasoning:
        typeof parsed.reasoning === "string" && parsed.reasoning.trim()
          ? parsed.reasoning.trim()
          : `Chose ${product.name} against the objective.`,
    };
  } catch {
    return chooseWithoutModel(catalog, budgets, alreadyBought);
  } finally {
    clearTimeout(timeout);
  }
}
