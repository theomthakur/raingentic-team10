import { Badge } from "../ui";

/**
 * The one diagram. Not the live per-run trace (that's PipelineDiagram, on the home page) —
 * this is the whole system, always fully drawn, color-coded by who owns each step, so it
 * can be understood without a run ever happening. One numbered, color-coded diagram beats
 * eight pages of prose: at a system-design-judged event, the diagram is the pitch.
 */

type Owner = "agent" | "check" | "refuse" | "hold" | "rain" | "record";

interface Step {
  n: string;
  name: string;
  owner: Owner;
  detail: string;
}

const STEPS: Step[] = [
  { n: "1", name: "Task", owner: "agent", detail: "An agent is given a job — restock supplies, provision compute, book freight." },
  { n: "1b", name: "Quote", owner: "agent", detail: "Sellers bid. A deterministic negotiation engine runs one counter-offer round per seller and picks a winner — the buyer never sees a fabricated price." },
  { n: "2", name: "Propose", owner: "agent", detail: "The agent declares the purchase order it wants: vendor, SKU, unit price, quantity, quote expiry." },
  { n: "3", name: "Verify", owner: "check", detail: "Eleven pure functions check the declared PO against the record — no model, no I/O, no wall clock. Rules are versioned data, not code." },
  { n: "4a", name: "Refuse", owner: "refuse", detail: "Any check fails → no card is ever created. A plain-English reason is logged, not a decline on an instrument that already exists." },
  { n: "4b", name: "Hold", owner: "hold", detail: "Every check passed, but the amount is above the delegated limit → still no card. A named person releases it, and every check runs again against fresh records before anything is issued." },
  { n: "4c", name: "Issue", owner: "rain", detail: "All checks pass → Rain issues a scoped virtual card bound to exactly this PO: this vendor, this amount, this expiry." },
  { n: "5", name: "Settle", owner: "rain", detail: "The purchase happens on that card. The cost centre's budget is charged and the PO is marked fulfilled." },
  { n: "6", name: "Record", owner: "record", detail: "PO, checks, rule version, card, and outcome are appended to the log — never edited in place. Each rule version's hash is anchored on Monad testnet, so the rules provably weren't rewritten after the fact." },
  { n: "7", name: "Revoke", owner: "rain", detail: "The card is deactivated once the job is done, closing the window it was ever usable in." },
];

const OWNER_STYLE: Record<Owner, { dot: string; text: string; bg: string; label: string }> = {
  agent: { dot: "bg-ink-400", text: "text-ink-700", bg: "bg-white", label: "agent" },
  check: { dot: "bg-mint-500", text: "text-mint-700", bg: "bg-mint-50/60", label: "deterministic check" },
  refuse: { dot: "bg-fail", text: "text-fail", bg: "bg-red-50/60", label: "refusal branch" },
  rain: { dot: "bg-rain-500", text: "text-rain-700", bg: "bg-rain-50/50", label: "Rain" },
  hold: { dot: "bg-warn", text: "text-warn", bg: "bg-amber-50/60", label: "waiting on a person" },
  record: { dot: "bg-ink-700", text: "text-ink-900", bg: "bg-white", label: "log + Monad anchor" },
};

export function SystemDiagram() {
  return (
    <div className="overflow-hidden rounded-2xl border border-edge bg-white shadow-sm shadow-ink-900/[0.03]">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-edge px-6 py-4">
        {(["agent", "check", "refuse", "rain", "record"] as Owner[]).map((o) => (
          <span key={o} className="flex items-center gap-1.5 text-[12px] text-muted">
            <span className={`h-2 w-2 rounded-full ${OWNER_STYLE[o].dot}`} />
            {OWNER_STYLE[o].label}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1.5">
          <Badge tone="monad">rule versions anchored on monad</Badge>
        </span>
      </div>

      <ol className="divide-y divide-edge">
        {STEPS.map((s) => {
          const style = OWNER_STYLE[s.owner];
          return (
            <li key={s.n} className={`flex items-start gap-4 px-6 py-4 ${style.bg}`}>
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-mono text-[12px] font-bold ${style.text}`}
                style={{ borderColor: "currentColor" }}
              >
                {s.n}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[14.5px] font-semibold ${style.text}`}>{s.name}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-600">{s.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
