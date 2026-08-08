"use client";

import type { BudgetRecord } from "@/lib/types";
import { money } from "@/lib/format";
import { departmentName } from "@/lib/plain";
import { Panel } from "./ui";

/** What each department has left to spend, moving as approvals settle. */
export function BudgetMeter({ budgets }: { budgets: BudgetRecord[] }) {
  return (
    <Panel title="What each department has left">
      <ul className="divide-y divide-edge">
        {budgets.map((b) => {
          const used = b.limitCents === 0 ? 0 : b.spentCents / b.limitCents;
          const pct = Math.min(100, Math.max(0, used * 100));
          const tight = used > 0.9;
          const remaining = b.limitCents - b.spentCents;

          return (
            <li key={b.costCentre} className="px-5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium text-ink-900">
                  {departmentName(b.costCentre)}
                </span>
                <span className="tabular font-mono text-[13px] font-semibold text-ink-900">
                  {money(remaining)} left
                </span>
              </div>

              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    tight ? "bg-warn" : "bg-mint-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <p className="mt-1 flex items-baseline justify-between gap-2 text-[11.5px] text-muted">
                <span>
                  {money(b.spentCents)} spent of {money(b.limitCents)}
                  {tight && <span className="ml-1.5 font-medium text-warn">· nearly gone</span>}
                </span>
                <span className="font-mono text-[10.5px] text-ink-300">{b.costCentre}</span>
              </p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
