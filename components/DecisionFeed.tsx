"use client";

import type { Decision } from "@/lib/types";
import { poTotal } from "@/lib/types";
import { money, shortDate, shortTime } from "@/lib/format";
import { getAgent } from "@/lib/agents";
import { departmentName, productName } from "@/lib/plain";
import { Avatar } from "./Avatar";
import { Badge, Empty, Panel } from "./ui";

/**
 * The append-only log, newest first.
 *
 * Each row answers, in this order: what was bought, from whom, for how much, and what
 * happened to it. The PO number and SKU are still here because an auditor needs them, but
 * they sit underneath as reference rather than being the first thing to decode.
 */

const OUTCOME_STYLE = {
  approved: { dot: "bg-mint-500", text: "text-mint-700", label: "Approved" },
  held: { dot: "bg-warn", text: "text-warn", label: "Waiting for a person" },
  refused: { dot: "bg-fail", text: "text-fail", label: "Refused" },
} as const;

export function DecisionFeed({
  decisions,
  selectedId,
  onSelect,
}: {
  decisions: Decision[];
  selectedId: string | null;
  onSelect: (d: Decision) => void;
}) {
  const live = decisions.filter((d) => !d.seeded).length;
  const refused = decisions.filter((d) => d.outcome === "refused").length;
  const held = decisions.filter((d) => d.outcome === "held").length;

  return (
    <Panel
      title="Every purchase, and what happened to it"
      right={
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{decisions.length} total</Badge>
          {held > 0 && <Badge tone="warn">{held} waiting</Badge>}
          <Badge tone="fail">{refused} refused</Badge>
          {live > 0 && <Badge tone="pass">{live} this session</Badge>}
        </div>
      }
    >
      {decisions.length === 0 ? (
        <Empty>Nothing recorded yet.</Empty>
      ) : (
        <ul className="max-h-[520px] divide-y divide-edge overflow-y-auto">
          {decisions.map((d) => {
            const selected = d.id === selectedId;
            const firstFailure = d.checks.find((c) => !c.passed && !c.skipped);
            const style = OUTCOME_STYLE[d.outcome];
            const agent = getAgent(d.agent);

            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onSelect(d)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                    selected ? "bg-rain-50" : "hover:bg-ink-50"
                  } ${!d.seeded ? "animate-row-in" : ""}`}
                >
                  <Avatar name={d.po.vendor} size={30} className="mt-0.5" />

                  <span className="min-w-0 flex-1">
                    {/* What was bought, in words, and what it cost. */}
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13.5px] font-medium text-ink-900">
                        {d.po.quantity} × {productName(d.po.sku)}
                      </span>
                      <span className="tabular shrink-0 font-mono text-[13.5px] font-semibold text-ink-900">
                        {money(poTotal(d.po))}
                      </span>
                    </span>

                    {/* Who from, who asked, which budget. */}
                    <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                      {d.po.vendor} · asked for by {agent.name} · {departmentName(d.po.costCentre)}
                    </span>

                    {/* What happened, and why if it did not go through. */}
                    <span className="mt-1.5 flex items-baseline justify-between gap-3">
                      <span className={`flex min-w-0 items-center gap-1.5 text-[12px] ${style.text}`}>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
                        <span className="truncate font-medium">
                          {style.label}
                          {d.outcome === "refused" && firstFailure && (
                            <span className="font-normal"> — {firstFailure.reason}</span>
                          )}
                        </span>
                      </span>
                      <span className="tabular shrink-0 font-mono text-[11px] text-ink-400">
                        {d.seeded ? shortDate(d.createdAt) : shortTime(d.createdAt)}
                      </span>
                    </span>

                    {/* Reference codes last — present for an auditor, not in the way. */}
                    <span className="mt-1 block truncate font-mono text-[10.5px] text-ink-300">
                      {d.po.poNumber} · {d.po.sku} · {d.po.costCentre}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
