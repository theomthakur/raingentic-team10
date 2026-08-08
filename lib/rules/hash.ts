import { createHash } from "node:crypto";
import type { Rule } from "@/lib/types";

/**
 * Deterministic JSON. Key order in a JS object is not guaranteed to be stable across
 * edits, and a hash that changes when nothing changed is worse than no hash — it would
 * mean re-anchoring a rule version that never actually moved.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

/**
 * The hash of a rule version. This exact string is what gets anchored on Monad, so that
 * every decision referencing version N is provably judged against rules that existed
 * before it — replay proves the rules are data, the anchor proves they weren't backdated.
 */
export function hashRules(rules: Rule[]): string {
  const ordered = [...rules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return createHash("sha256").update(canonical(ordered)).digest("hex");
}

export { canonical as canonicalJson };
