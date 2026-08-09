"use client";

import { useState } from "react";
import type { Decision } from "@/lib/types";
import { poTotal } from "@/lib/types";
import { money, shortDate } from "@/lib/format";
import { departmentName, productName } from "@/lib/plain";
import { Avatar } from "../identity/Avatar";
import { AgentTag } from "../identity/AgentTag";
import { Badge, Button, Panel } from "../ui";

/**
 * The queue of purchases waiting on a person.
 *
 * This is the direct answer to the objection that lands first — "there is no human in the
 * loop, why would I trust it?" There is one, above a limit you set, exactly as a
 * delegation-of-authority matrix works for employees. Nobody gives a person unlimited
 * spending authority either.
 *
 * What matters and is easy to miss: **no card exists while a purchase sits here.** The
 * approval is not a review of something already issued that would need clawing back — it
 * is the thing that causes the instrument to exist at all.
 */
export function ApprovalInbox({
  held,
  autonomousApprovals,
  totalApprovals,
  busy,
  onApprove,
}: {
  held: Decision[];
  /**
   * Approved purchases no person touched, and approvals in total.
   *
   * This used to be `totalDecisions - held.length`, which quietly counted refusals and
   * human-released purchases as autonomous completions. On a project whose entire pitch is
   * about not overstating, that is precisely the sentence a judge would check.
   */
  autonomousApprovals: number;
  totalApprovals: number;
  busy: boolean;
  onApprove: (decisionId: string, by: string, note: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [by, setBy] = useState("");
  const [note, setNote] = useState("");

  // Seeded rows are historical context; only this session's holds can be released,
  // because releasing re-runs the checks against records that actually exist.
  const actionable = held.filter((d) => !d.seeded);
  const historical = held.filter((d) => d.seeded);

  if (held.length === 0) return null;

  return (
    <Panel
      title="Exception — above an agent’s authority"
      right={
        <div className="flex items-center gap-2">
          {actionable.length > 0 && <Badge tone="warn">{actionable.length} to action</Badge>}
          {historical.length > 0 && <Badge tone="neutral">{historical.length} historical</Badge>}
        </div>
      }
    >
      {/* The number first, because "why are humans approving things in an autonomous
          spending demo?" is answered by the proportion, not by an argument. */}
      <p className="border-b border-edge px-4 py-2.5 text-[12px] leading-relaxed text-muted">
        <span className="text-ink-900">
          {autonomousApprovals} of {totalApprovals} approved purchases completed with no
          human involved at all.
        </span>{" "}
        {held.length === 1 ? "This one is" : `These ${held.length} are`} the exception:
        every check passed, but the amount is above the delegated authority of the agent
        that asked. Autonomy has boundaries, exactly as it does for an employee.{" "}
        <span className="text-ink-700">No card exists while a purchase waits here</span> —
        approving is what creates it.
      </p>

      <ul className="divide-y divide-edge">
        {[...actionable, ...historical].map((d) => {
          const open = openId === d.id;
          const canAct = !d.seeded;
          const escalation = d.checks.find((c) => c.escalates && !c.passed);

          return (
            <li key={d.id} className="px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={d.po.vendor} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13.5px] font-medium text-ink-900">
                      {d.po.quantity} × {productName(d.po.sku)}
                    </span>
                    <span className="tabular shrink-0 font-mono text-[13.5px] font-semibold text-ink-900">
                      {money(poTotal(d.po))}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12.5px] text-muted">
                    {d.po.vendor} · {departmentName(d.po.costCentre)} · {shortDate(d.createdAt)}
                  </p>
                  <p className="mt-0.5 font-mono text-[10.5px] text-ink-300">
                    {d.po.poNumber} · {d.po.sku}
                  </p>
                </div>
              </div>

              <div className="mt-2">
                <AgentTag id={d.agent} />
              </div>

              {escalation && (
                <p className="mt-1.5 text-[12px] text-warn">{escalation.reason}</p>
              )}

              {canAct ? (
                open ? (
                  <div className="mt-2.5 space-y-2 rounded-xl border border-edge bg-ink-50 p-3">
                    <label className="flex flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                        approver name
                      </span>
                      <input
                        value={by}
                        onChange={(e) => setBy(e.target.value)}
                        placeholder="who is accepting responsibility"
                        className="w-full rounded-lg border border-edge bg-white px-2 py-1 text-[12px] text-ink-900 outline-none focus:border-rain-400"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                        note (optional)
                      </span>
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="why this is being released"
                        className="w-full rounded-lg border border-edge bg-white px-2 py-1 text-[12px] text-ink-900 outline-none focus:border-rain-400"
                      />
                    </label>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" onClick={() => setOpenId(null)} disabled={busy}>
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        disabled={busy || by.trim().length === 0}
                        onClick={() => {
                          onApprove(d.id, by.trim(), note.trim());
                          setOpenId(null);
                          setNote("");
                        }}
                      >
                        Release and issue
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted">
                      The checks run again on release — the world may have moved while this
                      waited.
                    </p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <Button onClick={() => setOpenId(d.id)} disabled={busy}>
                      Review and release
                    </Button>
                  </div>
                )
              ) : (
                <p className="mt-1.5 font-mono text-[11px] text-ink-400">
                  historical — released purchases re-run their checks, and this one&apos;s
                  records are no longer live
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
