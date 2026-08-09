/**
 * Optional LLM enrichment for the negotiation stage. Adds a natural-language seller remark
 * on top of an already-decided deterministic offer, never decides the offer itself.
 *
 * If GROQ_API_KEY is not set, or the call fails or is slow, this silently falls back to
 * the existing hardcoded note. The negotiation result is never blocked on this succeeding,
 * a flaky model call must never be able to stall a purchase in front of judges.
 */

import type { NegotiationOffer, NegotiationResult } from "./negotiation";

/**
 * The key, under either name.
 *
 * `GROQ_API_KEY` silently failed to arrive on Vercel while four other variables set the
 * same way arrived fine, and `llmEnabled` stayed false through several redeploys. Rather
 * than keep debugging one dashboard row against a deadline, the code accepts a second
 * name — set `GROQ_KEY` and it works regardless of what is wrong with the first.
 */
function groqKey(): string | undefined {
  return process.env.GROQ_API_KEY ?? process.env.GROQ_KEY;
}

const MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
/**
 * Generous enough for a cold serverless instance, short enough that a demo never stalls.
 *
 * 3s was fine on a laptop and marginal on Vercel: the enrichment fires six requests at
 * once and a cold container pays TLS setup on top, so the abort could fire before any of
 * them returned — indistinguishable, from the outside, from the key being absent.
 */
const TIMEOUT_MS = 8000;

async function askGroq(prompt: string): Promise<string | null> {
  const apiKey = groqKey();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.6,
        max_tokens: 40,
        messages: [
          {
            role: "system",
            content:
              "You write one short sentence of sales-rep dialogue, in character, under 20 words. No quotes, no preamble.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null; // timeout, network error, malformed response, all fall back silently
  } finally {
    clearTimeout(timeout);
  }
}

function flavorPrompt(offer: NegotiationOffer, isWinner: boolean): string {
  const stance =
    offer.strategy === "firm"
      ? "You rarely discount and you're proud of your price."
      : offer.strategy === "discounter"
        ? "You compete hard on price and want to close fast."
        : offer.strategy === "bundler"
          ? "You'd rather add value than cut price."
          : "You have limited stock and want urgency.";

  return `You are a ${offer.label} vendor. ${stance} You just offered $${(offer.price / 100).toFixed(2)}. ${
    isWinner ? "You won this deal." : "You did not win this deal."
  } Say one short line to the buyer.`;
}

/**
 * Takes an already-computed NegotiationResult and tries to replace each offer's note with
 * an LLM-written line. Same shape in, same shape out, only .note fields can change.
 * Every call is independent and every failure is silent, this can never throw.
 */
export async function enrichWithLLMFlavor(result: NegotiationResult): Promise<NegotiationResult> {
  if (!groqKey()) return result; // not configured, skip entirely, no cost

  const enrichOffer = async (offer: NegotiationOffer): Promise<NegotiationOffer> => {
    const isWinner = offer.vendor === result.winner.vendor;
    const flavor = await askGroq(flavorPrompt(offer, isWinner));
    return flavor ? { ...offer, note: flavor } : offer;
  };

  const [openingOffers, finalOffers] = await Promise.all([
    Promise.all(result.openingOffers.map(enrichOffer)),
    Promise.all(result.finalOffers.map(enrichOffer)),
  ]);

  return { ...result, openingOffers, finalOffers };
}
