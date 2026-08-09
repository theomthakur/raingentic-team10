import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { anchorRuleVersion, anchoringEnabled, confirmRuleAnchor } from "@/lib/monad/anchor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Anchor a rule version's hash on Monad testnet.
 *
 * Only active versions are anchorable: a pending one has not been approved by anyone yet,
 * and publishing it would assert that a policy existed when it does not govern anything.
 */
export async function POST(request: Request) {
  let body: { version?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (typeof body.version !== "number") {
    return NextResponse.json({ error: "version is required." }, { status: 400 });
  }

  if (!anchoringEnabled()) {
    return NextResponse.json(
      {
        error:
          "Monad anchoring is not configured. Set MONAD_PRIVATE_KEY in .env.local and fund " +
          "it from faucet.monad.xyz. MONAD_RPC_URL is optional and defaults to Monad's " +
          "public testnet RPC.",
      },
      { status: 501 }
    );
  }

  const store = getStore();
  const ruleSet = await store.getRuleSet(body.version);
  if (!ruleSet) {
    return NextResponse.json({ error: `No policy v${body.version}.` }, { status: 404 });
  }
  if (ruleSet.status !== "active") {
    return NextResponse.json(
      { error: `Policy v${body.version} is still pending approval, nothing to anchor yet.` },
      { status: 409 }
    );
  }
  if (ruleSet.anchorTxHash) {
    return NextResponse.json(
      { error: `Policy v${body.version} is already anchored.`, txHash: ruleSet.anchorTxHash },
      { status: 409 }
    );
  }

  try {
    const anchor = await anchorRuleVersion(ruleSet.version, ruleSet.hash);
    const confirmed = await confirmRuleAnchor(ruleSet.version, ruleSet.hash, anchor.txHash);
    await store.setAnchor(ruleSet.version, confirmed.txHash);
    return NextResponse.json({ version: ruleSet.version, ...confirmed });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
