import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";
import { interpretWithModel, matchByKeyword } from "@/lib/intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read a sentence, return a structured purchase request.
 *
 * Interpretation only. This route never decides anything and never touches money, the
 * client takes what comes back and posts it to the same purchase endpoint every other
 * path uses, where the eleven checks judge it exactly as harshly as any other request.
 *
 * The model is tried first and the keyword matcher is the fallback, so a slow or missing
 * Groq key degrades the quality of the reading rather than breaking the page. `via` tells
 * the caller which happened, because the UI should not imply a model ran when one did not.
 */
export async function POST(request: Request) {
  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Tell me what you need." }, { status: 400 });
  }

  const catalog = getCatalog();

  const fromModel = await interpretWithModel(text, catalog);
  if (fromModel) {
    return NextResponse.json({ ...fromModel, via: "model" });
  }

  const fromKeywords = matchByKeyword(text, catalog);
  if (fromKeywords) {
    return NextResponse.json({ ...fromKeywords, via: "keywords" });
  }

  return NextResponse.json(
    {
      error:
        "I could not match that to anything in the catalogue. Try paper, GPU compute, brackets, sensors, chairs, freight, or conveyor sections.",
    },
    { status: 422 }
  );
}
