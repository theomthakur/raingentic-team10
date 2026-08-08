"use client";

import type { BudgetRecord } from "@/lib/types";
import { money } from "@/lib/format";
import { Panel } from "./ui";

/** Remaining budget per cost centre, moving as approvals settle. */
export function BudgetMeter({ budgets }: { budgets: BudgetRecord[] }) {
  return (
    <Panel title="Budgets">
      <ul className="space-y-2.5 px-4 py-3">
        {budgets.map((b) => {
          const used = b.limitCents === 0 ? 0 : b.spentCents / b.limitCents;
          const pct = Math.min(100, Math.max(0, used * 100));
          const tight = used > 0.9;
          return (
            <li key={b.costCentre}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[12px] text-slate-300">{b.costCentre}</span>
                <span className="tabular font-mono text-[11px] text-muted">
                  {money(b.limitCents - b.spentCents)} left
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-edge">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    tight ? "bg-warn" : "bg-emerald-500/70"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
