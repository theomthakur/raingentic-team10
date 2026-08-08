"use client";

import type { ReplayChange, ReplayResult } from "@/lib/types";
import { money } from "@/lib/format";
import { Badge, Empty, Panel } from "./ui";

/**
 * The replay diff.
 *
 * This is the headline. It is only trustworthy because of two earlier decisions: each
 * decision stored the record as it read it rather than a pointer to a record that has
 * since moved, and nothing in the check path is a model, so a difference here can only
 * have come from the rule change.
 */

function ChangeRow({ change, tone }: { change: ReplayChange; tone: "fail" | "pass" }) {
  const drivers = tone === "fail" ? change.nowFailing : change.nowPassing;
  return (
    <li className="px-4 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate font-mono text-[12px] text-slate-300">
          {change.poNumber}
          <span className="ml-2 text-muted">{change.vendor}</span>
        </span>
        <span className="tabular shrink-0 font-mono text-[12px] text-slate-400">
          {money(change.totalCents)}
        </span>
      </div>
      {drivers.length > 0 && (
        <p className={`mt-0.5 text-[12px] ${tone === "fail" ? "text-fail/80" : "text-pass/80"}`}>
          {tone === "fail" ? "now fails" : "no longer fails"}: {drivers[0].label}
        </p>
      )}
    </li>
  );
}

export function ReplayDiff({ result }: { result: ReplayResult | null }) {
  if (!result) {
    return (
      <Panel title="Replay">
        <Empty>
          Edit a rule, then replay it across the decision log to see what the change would
          have done.
        </Empty>
      </Panel>
    );
  }

  const refusedNow = result.approvedNowRefused.length;
  const approvedNow = result.refusedNowApproved.length;
  const noChange = refusedNow === 0 && approvedNow === 0;

  return (
    <Panel
      title="Replay"
      right={
        <Badge tone="neutral">
          v{result.fromVersion} → v{result.toVersion}
        </Badge>
      }
    >
      {/* The sentence to read out loud. */}
      <p className="border-b border-edge px-4 py-3 text-[13px] leading-relaxed text-slate-200">
        Across{" "}
        <span className="tabular font-mono font-semibold">{result.total}</span> recorded
        decisions,{" "}
        {noChange ? (
          <>nothing changes under this policy.</>
        ) : (
          <>
            <span className="tabular font-mono font-semibold text-fail">{refusedNow}</span>{" "}
            {refusedNow === 1 ? "approval" : "approvals"} would now be refused and{" "}
            <span className="tabular font-mono font-semibold text-pass">{approvedNow}</span>{" "}
            {approvedNow === 1 ? "refusal" : "refusals"} would now pass.
          </>
        )}{" "}
        <span className="text-muted">
          {result.unchanged} unchanged.
        </span>
      </p>

      <div className="max-h-80 overflow-y-auto">
        {refusedNow > 0 && (
          <div>
            <p className="bg-fail/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fail">
              approved → refused
            </p>
            <ul className="divide-y divide-edge/60">
              {result.approvedNowRefused.map((c) => (
                <ChangeRow key={c.decisionId} change={c} tone="fail" />
              ))}
            </ul>
          </div>
        )}

        {approvedNow > 0 && (
          <div>
            <p className="bg-pass/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-pass">
              refused → approved
            </p>
            <ul className="divide-y divide-edge/60">
              {result.refusedNowApproved.map((c) => (
                <ChangeRow key={c.decisionId} change={c} tone="pass" />
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
