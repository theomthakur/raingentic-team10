import { createWalletClient, defineChain, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Anchor a rule version's hash on Monad testnet.
 *
 * **Why the rule version and not every decision.** Replay proves the rules are data rather
 * than code. It does not prove the rules were not rewritten afterwards to fit a history
 * someone already had — and "trust our timestamps" is no answer, because the timestamps
 * are ours too. Publishing each version's hash to a chain nobody controls gives it an
 * independent existence proof, so every decision citing v1 is provably judged against
 * rules that existed before it.
 *
 * That is why this is structural rather than decorative: remove it and a specific sentence
 * in the pitch stops being true.
 *
 * **Why Monad specifically**, said honestly rather than performed: you *have* to anchor
 * the versions or the audit claim collapses, and that is a handful of writes. You also
 * *want* to anchor every individual decision, and there are thousands. On a chain costing
 * 50 cents a write you would anchor the rules and give up on the decisions. Only somewhere
 * this cheap and this fast lets you afford both.
 *
 * **The transaction.** A zero-value transaction to the sender's own address carrying the
 * hash in the calldata. No contract to deploy, no contract to get wrong — the payload is
 * the point, and it is a real transaction either way.
 */

/**
 * Monad testnet, chain id 10143, per Monad's own network information page. Mainnet is
 * live and is chain id 143 — deliberately not used here, since the bounty asks for
 * testnet and a real testnet transaction is still a real transaction.
 * https://docs.monad.xyz/developer-essentials/testnet
 */
const DEFAULT_TESTNET_RPC = "https://testnet-rpc.monad.xyz";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [process.env.MONAD_RPC_URL ?? DEFAULT_TESTNET_RPC] } },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
});

export interface AnchorResult {
  txHash: string;
  explorerUrl: string;
}

/**
 * Enabled as soon as a key exists. The RPC falls back to Monad's public testnet endpoint,
 * which is rate-limited but ample for a handful of rule-version writes — so requiring it
 * explicitly would only mean silently disabling anchoring for someone who supplied the
 * one credential that cannot be defaulted.
 *
 * The key is the real dependency: an RPC is a public address, a funded key is not.
 */
export function anchoringEnabled(): boolean {
  return Boolean(process.env.MONAD_PRIVATE_KEY);
}

/** Whichever endpoint is in play, so the UI can say where an anchor was sent. */
export function anchorRpcUrl(): string {
  return process.env.MONAD_RPC_URL ?? DEFAULT_TESTNET_RPC;
}

function normalisePrivateKey(raw: string): Hex {
  const trimmed = raw.trim();
  return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as Hex;
}

/**
 * Write `ruleHash` to the chain and return the transaction hash.
 *
 * Throws if anchoring is not configured — callers decide whether that is fatal. Nothing
 * in the decision path depends on this succeeding: a rule version works exactly the same
 * unanchored, it simply carries a weaker claim.
 */
export async function anchorRuleVersion(
  version: number,
  ruleHash: string
): Promise<AnchorResult> {
  if (!anchoringEnabled()) {
    throw new Error(
      "Monad anchoring is not configured. Set MONAD_PRIVATE_KEY in .env.local (fund it from " +
        "faucet.monad.xyz). MONAD_RPC_URL is optional and defaults to Monad's public testnet RPC."
    );
  }

  const account = privateKeyToAccount(normalisePrivateKey(process.env.MONAD_PRIVATE_KEY!));
  const client = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(anchorRpcUrl()),
  });

  const clean = ruleHash.startsWith("0x") ? ruleHash.slice(2) : ruleHash;
  if (!/^[0-9a-f]{64}$/i.test(clean)) {
    throw new Error(`Not a sha256 hash: ${ruleHash}`);
  }

  const txHash = await client.sendTransaction({
    to: account.address,
    // BigInt(0) rather than 0n: the literal form needs an ES2020 target, and this file
    // is not worth pinning the whole project's output level over.
    value: BigInt(0),
    // The payload is the whole point: version number then the hash, so the transaction
    // is self-describing to anyone reading it off the chain later.
    data: `0x${version.toString(16).padStart(8, "0")}${clean}` as Hex,
  });

  return {
    txHash,
    explorerUrl: `https://testnet.monadexplorer.com/tx/${txHash}`,
  };
}
