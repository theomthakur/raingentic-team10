"use client";

import type { Decision } from "@/lib/types";
import { poTotal } from "@/lib/types";
import { money, shortDate, shortTime } from "@/lib/format";
import { getAgent } from "@/lib/agents";
import { Avatar } from "./Avatar";
import { Badge, Empty, Panel } from "./ui";

/**
 * The append-only log, newest first.
 *
 * Live rows are marked apart from seeded history so nothing on screen overstates what
 * just happened in front of the judge.
 */
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

  return (
    <Panel
      title="Decision log"
      right={
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{decisions.length} total</Badge>
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
            const isNew = !d.seeded;
            const dotClass =
              d.outcome === "refused" ? "bg-fail" : d.outcome === "held" ? "bg-warn" : "bg-mint-500";
            const agent = getAgent(d.agent);

            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onSelect(d)}
                  className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition ${
                    selected ? "bg-rain-50" : "hover:bg-ink-50"
                  } ${isNew ? "animate-row-in" : ""}`}
                >
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
                  <Avatar name={d.po.vendor} size={24} className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-mono text-[13px] text-ink-900">
                        {d.po.poNumber}
                        <span className="ml-2 font-sans text-muted">{d.po.vendor}</span>
                      </span>
                      <span className="tabular shrink-0 font-mono text-[13px] text-ink-700">
                        {money(poTotal(d.po))}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-baseline justify-between gap-3">
                      <span className="truncate text-[12px] text-muted">
                        {d.outcome === "refused" && firstFailure
                          ? firstFailure.reason
                          : `${d.po.quantity} × ${d.po.sku} · ${agent.name}`}
                      </span>
                      <span className="tabular shrink-0 font-mono text-[11px] text-ink-400">
                        {d.seeded ? shortDate(d.createdAt) : shortTime(d.createdAt)}
                      </span>
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
