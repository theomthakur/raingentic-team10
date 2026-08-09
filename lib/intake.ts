import type { CatalogProduct } from "./catalog";

/**
 * Turning a sentence a person typed into a structured purchase request.
 *
 * This is the one place a model is allowed to *interpret*, and it is worth being precise
 * about why that is safe. The model never decides whether a purchase is allowed — it only
 * reads "I need a couple of boxes of paper, cheapest you can find" and returns
 * `{ productId: "office-supplies", quantity: 2 }`. Everything downstream is the same
 * eleven deterministic checks, reading the same system of record.
 *
 * That split is the whole architecture in miniature: **the model proposes, deterministic
 * code decides.** A wrong interpretation produces a wrong purchase *request*, which then
 * gets checked exactly as harshly as any other. It cannot produce a wrong *decision*.
 *
 * The keyword matcher it replaces was the honest version of the same idea and a liability
 * in front of judges: a hardcoded term table plus a regex for the first integer, which
 * "3 chairs and 2 sensors" or "cheapest paper you have" both defeat instantly. Looking
 * intelligent without being intelligent is the exact thing this project argues against.
 */

export interface IntakeResult {
  productId: string;
  quantity: number;
  /** What the model understood, in its own words, shown back to the user. */
  understood: string;
}

function groqKey(): string | undefined {
  return process.env.GROQ_API_KEY ?? process.env.GROQ_KEY;
}

const MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
const TIMEOUT_MS = 8000;

/**
 * Deterministic fallback, kept deliberately.
 *
 * If the model is unreachable the intake still works on the obvious phrasings, and the UI
 * says which path it took. A demo that dies because an API was slow is worse than one that
 * degrades and admits it.
 */
const TERMS: Array<{ id: string; terms: string[] }> = [
  { id: "office-supplies", terms: ["paper", "a4", "ream"] },
  { id: "cloud-compute", terms: ["gpu", "compute", "a100", "training"] },
  { id: "PO-4417", terms: ["bracket", "mounting"] },
  { id: "PO-4418", terms: ["sensor", "proximity"] },
  { id: "PO-4419", terms: ["alloy", "billet"] },
  { id: "PO-4421", terms: ["chair", "seating"] },
  { id: "PO-4422", terms: ["freight", "shipping", "lane"] },
  { id: "PO-4423", terms: ["conveyor", "conveyer"] },
];

/**
 * Suggestions should not depend on the model merely to understand "two boxes". The
 * model remains the primary interpreter, but this small fallback covers ordinary written
 * quantities too, so the main-page examples stay dependable during a model timeout.
 */
const QUANTITY_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  dozen: 12,
};

function quantityFromText(text: string, fallback: number): number {
  const numeric = text.match(/\b(\d+)\b/)?.[1];
  if (numeric) return Number(numeric);

  const word = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|dozen)\b/)?.[1];
  if (word) return QUANTITY_WORDS[word];

  if (/\ba couple(?: of)?\b/.test(text)) return 2;
  if (/\ba few\b/.test(text)) return 3;
  return fallback;
}

export function matchByKeyword(text: string, catalog: CatalogProduct[]): IntakeResult | null {
  const normalized = text.toLowerCase();
  const hit = TERMS.find(({ terms }) => terms.some((t) => normalized.includes(t)));
  if (!hit) return null;
  const product = catalog.find((p) => p.id === hit.id);
  if (!product) return null;
  const quantity = quantityFromText(normalized, product.quotedQuantity ?? 1);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return { productId: product.id, quantity, understood: `${quantity} × ${product.name}` };
}

/**
 * Ask the model to pick a catalogue line and a quantity.
 *
 * Constrained hard on purpose: it chooses from an enumerated list of ids that already
 * exist, and returns JSON. It cannot invent a product, a price, or a supplier — the worst
 * it can do is pick the wrong row, which the checks then judge on its merits.
 */
export async function interpretWithModel(
  text: string,
  catalog: CatalogProduct[]
): Promise<IntakeResult | null> {
  const apiKey = groqKey();
  if (!apiKey) return null;

  const menu = catalog
    .map((p) => `${p.id} = ${p.name} (${p.unit}, ${(p.fromCents / 100).toFixed(2)} each)`)
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
        temperature: 0,
        max_tokens: 120,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You route a purchasing request to exactly one catalogue line.\n" +
              "Reply with JSON only: {\"productId\": string, \"quantity\": integer, \"understood\": string}.\n" +
              "productId MUST be one of the ids listed. Never invent one.\n" +
              "quantity is a positive integer; infer it from the request (\"a couple\" = 2, " +
              "\"a few\" = 3). If no quantity is stated, use 1.\n" +
              "understood is a short plain-English restatement, under 12 words.\n" +
              "If nothing in the catalogue fits, use productId \"none\".\n\n" +
              `Catalogue:\n${menu}`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<IntakeResult>;
    const product = catalog.find((p) => p.id === parsed.productId);
    const quantity = Number(parsed.quantity);
    if (!product || !Number.isFinite(quantity) || quantity <= 0) return null;

    return {
      productId: product.id,
      quantity: Math.floor(quantity),
      understood:
        typeof parsed.understood === "string" && parsed.understood.trim()
          ? parsed.understood.trim()
          : `${quantity} × ${product.name}`,
    };
  } catch {
    // Timeout, network, or malformed JSON. The caller falls back to keywords.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
