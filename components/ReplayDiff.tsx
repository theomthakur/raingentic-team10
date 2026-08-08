"use client";

import type { ReplayChange, ReplayFlip, ReplayResult } from "@/lib/types";
import type { RuleChange } from "@/lib/rules/diff";
import { money } from "@/lib/format";
import { Badge, Empty, Panel } from "./ui";

/**
 * The replay diff — the headline moment.
 *
 * It is only trustworthy because of two earlier decisions: each decision stored the record
 * as it read it rather than a pointer to a record that has since moved, and nothing in the
 * check path is a model. So a difference here can only have come from the rule change,
 * which is why the panel names that change at the top and lets the numbers follow from it.
 */

function StatTile({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "fail" | "pass" | "neutral";
}) {
  const tones = {
    fail: "border-danger-200 bg-danger-50 text-fail",
    pass: "border-mint-200 bg-mint-50 text-mint-700",
    neutral: "border-edge bg-ink-50 text-ink-500",
  } as const;
  return (
    <div className={`flex-1 rounded-xl border px-3 py-2.5 text-center ${tones[tone]}`}>
      <div className="tabular font-mono text-2xl font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase leading-tight tracking-wider opacity-80">
        {label}
      </div>
    </div>
  );
}

/** The before/after of one rule on one decision. This is the actual explanation. */
function FlipDetail({ flip, tone }: { flip: ReplayFlip; tone: "fail" | "pass" }) {
  const { now, previously } = flip;
  const verdict = (c: { passed: boolean; skipped?: boolean }) =>
    c.skipped ? "not evaluated" : c.passed ? "pass" : "fail";

  return (
    <div className="mt-1.5 space-y-1 border-l-2 border-edge pl-2.5">
      <p className={`text-[12px] font-medium ${tone === "fail" ? "text-fail" : "text-mint-700"}`}>
        {now.label}
      </p>
      {previously && (
        <p className="font-mono text-[11px] text-ink-400">
          <span className="text-ink-300">was </span>
          {verdict(previously)}
          <span className="text-ink-300"> · expected </span>
          {previously.expected}
        </p>
      )}
      <p className="font-mono text-[11px] text-ink-600">
        <span className="text-ink-300">now </span>
        {verdict(now)}
        <span className="text-ink-300"> · expected </span>
        {now.expected}
        <span className="text-ink-300"> · got </span>
        <span className={tone === "fail" ? "text-fail" : "text-mint-700"}>{now.actual}</span>
      </p>
    </div>
  );
}

function ChangeRow({
  change,
  tone,
  onSelect,
}: {
  change: ReplayChange;
  tone: "fail" | "pass";
  onSelect?: (id: string) => void;
}) {
  const flips = tone === "fail" ? change.nowFailing : change.nowPassing;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect?.(change.decisionId)}
        className="w-full px-4 py-2.5 text-left transition hover:bg-ink-50"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-mono text-[12px] text-ink-900">
              {change.poNumber}
            </span>
            <span className="truncate text-[12px] text-muted">{change.vendor}</span>
          </span>
          <span className="tabular shrink-0 font-mono text-[12px] text-ink-600">
            {money(change.totalCents)}
          </span>
        </div>
        {flips.slice(0, 1).map((f) => (
          <FlipDetail key={f.now.ruleId} flip={f} tone={tone} />
        ))}
      </button>
    </li>
  );
}

/** What actually changed in the policy. Shown first, because it causes everything below. */
function RuleChanges({ changes }: { changes: RuleChange[] }) {
  if (changes.length === 0) return null;
  return (
    <div className="border-b border-edge bg-rain-50/60 px-4 py-2.5">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-rain-700">
        what changed in the policy
      </p>
      <ul className="space-y-1">
        {changes.map((c) => (
          <li key={`${c.ruleId}-${c.field}`} className="flex items-baseline gap-2 text-[12px]">
            <span className="text-ink-700">{c.label}</span>
            <span className="ml-auto shrink-0 font-mono text-[11px]">
              <span className="text-ink-400">{c.field} </span>
              <span className="text-ink-400 line-through">{c.before}</span>
              <span className="mx-1 text-ink-300">→</span>
              <span className="font-semibold text-rain-600">{c.after}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReplayDiff({
  result,
  ruleChanges = [],
  onSelectDecision,
}: {
  result: ReplayResult | null;
  ruleChanges?: RuleChange[];
  onSelectDecision?: (id: string) => void;
}) {
  if (!result) {
    return (
      <Panel title="Replay">
        <Empty>
          Change a rule above, then replay it across the decision log to see what that
          change would have done to history.
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
      <RuleChanges changes={ruleChanges} />

      <div className="flex gap-2 px-4 py-3">
        <StatTile value={refusedNow} label="approved → refused" tone="fail" />
        <StatTile value={approvedNow} label="refused → approved" tone="pass" />
        <StatTile value={result.unchanged} label="unchanged" tone="neutral" />
      </div>

      {/* The sentence to read out loud. */}
      <p className="border-y border-edge px-4 py-2.5 text-[13px] leading-relaxed text-ink-900">
        {noChange ? (
          <>
            Across <span className="tabular font-mono font-semibold">{result.total}</span>{" "}
            recorded decisions, nothing changes under this policy.
          </>
        ) : (
          <>
            Across <span className="tabular font-mono font-semibold">{result.total}</span>{" "}
            recorded decisions,{" "}
            <span className="tabular font-mono font-semibold text-fail">{refusedNow}</span>{" "}
            {refusedNow === 1 ? "approval" : "approvals"} would now be refused and{" "}
            <span className="tabular font-mono font-semibold text-mint-700">{approvedNow}</span>{" "}
            {approvedNow === 1 ? "refusal" : "refusals"} would now pass.
          </>
        )}
      </p>

      <div className="max-h-[26rem] overflow-y-auto">
        {refusedNow > 0 && (
          <div>
            <p className="sticky top-0 bg-danger-50 px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fail">
              approved → refused
            </p>
            <ul className="divide-y divide-edge">
              {result.approvedNowRefused.map((c) => (
                <ChangeRow key={c.decisionId} change={c} tone="fail" onSelect={onSelectDecision} />
              ))}
            </ul>
          </div>
        )}

        {approvedNow > 0 && (
          <div>
            <p className="sticky top-0 bg-mint-50 px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-mint-700">
              refused → approved
            </p>
            <ul className="divide-y divide-edge">
              {result.refusedNowApproved.map((c) => (
                <ChangeRow key={c.decisionId} change={c} tone="pass" onSelect={onSelectDecision} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {!noChange && (
        <p className="border-t border-edge px-4 py-2 text-[11px] text-muted">
          Click any row to audit that decision. Nothing here is recomputed from today&apos;s
          records — each one is re-judged against the snapshot it read at the time.
        </p>
      )}
    </Panel>
  );
}
