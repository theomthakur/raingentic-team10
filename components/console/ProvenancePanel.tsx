"use client";

import type { CheckResult, Decision } from "@/lib/types";
import { poTotal } from "@/lib/types";
import { money, shortDate } from "@/lib/format";
import { departmentName, outcomeSummary, productName, ruleQuestion } from "@/lib/plain";
import { generateReceipt } from "@/lib/receipt";
import { basisFor } from "@/lib/rules/basis";
import { Avatar } from "../identity/Avatar";
import { AgentTag } from "../identity/AgentTag";
import { Badge, Button, Empty, Panel } from "../ui";

/**
 * The audit view for one decision, written for the person who has to sign off on it.
 *
 * Three sections, deliberately in this order: what was bought, what happened and why, and
 * then the evidence. Someone who only reads the first two paragraphs should still come
 * away with the right answer; the codes and the raw snapshot are underneath for the
 * auditor who needs to verify rather than understand.
 */

function CheckRow({ check }: { check: CheckResult }) {
  const failed = !check.passed && !check.skipped;
  const escalated = check.escalates && !check.passed;
  // Where a rule that just stopped a purchase comes from. Shown on the row that decided
  // something, because "we refused this" is an assertion and "we refused this, and here is
  // the established control that says so" is an argument.
  const basis = basisFor(check.ruleId);

  const mark = check.skipped
    ? { glyph: "–", cls: "bg-ink-100 text-ink-400", word: "Not checked" }
    : escalated
      ? { glyph: "⏸", cls: "bg-amber-100 text-warn", word: "Needs a person" }
      : check.passed
        ? { glyph: "✓", cls: "bg-mint-100 text-mint-700", word: "Yes" }
        : { glyph: "✕", cls: "bg-red-100 text-fail", word: "No" };

  return (
    <li className={`px-5 py-3 ${failed && !escalated ? "bg-red-50/50" : escalated ? "bg-amber-50/40" : ""}`}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${mark.cls}`}
          title={mark.word}
        >
          {mark.glyph}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-medium text-ink-900">{ruleQuestion(check.ruleId)}</p>
            <span
              className={`shrink-0 text-[12px] font-semibold ${
                check.skipped
                  ? "text-ink-400"
                  : escalated
                    ? "text-warn"
                    : check.passed
                      ? "text-mint-700"
                      : "text-fail"
              }`}
            >
              {mark.word}
            </span>
          </div>

          <p className={`mt-0.5 text-[12.5px] leading-relaxed ${failed ? "text-ink-800" : "text-muted"}`}>
            {check.reason}
          </p>

          {/* The evidence, only where it decided something. */}
          {failed && (
            <table className="mt-2 w-full border-separate border-spacing-0 text-left">
              <tbody className="font-mono text-[11px]">
                <tr>
                  <th className="w-24 py-0.5 pr-3 font-normal text-ink-400">Expected</th>
                  <td className="tabular py-0.5 text-mint-700">{check.expected}</td>
                </tr>
                <tr>
                  <th className="py-0.5 pr-3 font-normal text-ink-400">Got</th>
                  <td className="tabular py-0.5 text-fail">{check.actual}</td>
                </tr>
                <tr>
                  <th className="py-0.5 pr-3 font-normal text-ink-400">Read from</th>
                  <td className="py-0.5 text-ink-500">{check.readFrom}</td>
                </tr>
                {basis && (
                  <tr>
                    <th className="py-0.5 pr-3 align-top font-normal text-ink-400">Basis</th>
                    <td className="py-0.5 font-sans text-[11.5px] leading-snug text-ink-500">
                      {basis}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </li>
  );
}

export function ProvenancePanel({ decision }: { decision: Decision | null }) {
  if (!decision) {
    return (
      <Panel title="Why this was allowed, or wasn't">
        <Empty>Pick a purchase from the list to see exactly how it was decided.</Empty>
      </Panel>
    );
  }

  const { po, record, checks, outcome } = decision;
  const total = poTotal(po);
  const summary = outcomeSummary(outcome);
  const tone = outcome === "approved" ? "pass" : outcome === "held" ? "warn" : "fail";
  const answered = checks.filter((c) => !c.skipped).length;
  const passed = checks.filter((c) => c.passed && !c.skipped).length;

  return (
    <Panel
      title="Why this was allowed, or wasn't"
      right={
        <div className="flex items-center gap-2">
          <Badge tone={tone}>{summary.label}</Badge>
          <Button variant="ghost" onClick={() => generateReceipt(decision)}>
            Download PDF
          </Button>
        </div>
      }
    >
      {/* 1, what was bought */}
      <div className="border-b border-edge px-5 py-4">
        <div className="flex items-start gap-3">
          <Avatar name={po.vendor} size={34} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[15px] font-semibold text-ink-900">
                {po.quantity} × {productName(po.sku)}
              </p>
              <p className="tabular font-mono text-[15px] font-semibold text-ink-900">
                {money(total)}
              </p>
            </div>
            <p className="mt-0.5 text-[13px] text-muted">
              from {po.vendor} · {money(po.unitPrice)} each · {departmentName(po.costCentre)} budget
            </p>
          </div>
        </div>

        <div className="mt-3">
          <AgentTag id={decision.agent} />
        </div>
      </div>

      {/* 2, what happened, in one sentence */}
      <div
        className={`border-b border-edge px-5 py-3.5 ${
          outcome === "approved" ? "bg-mint-50/50" : outcome === "held" ? "bg-amber-50/50" : "bg-red-50/50"
        }`}
      >
        <p className="text-[13.5px] font-semibold text-ink-900">{summary.label}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-700">{summary.meaning}</p>

        {/* The card details, where one exists. The no-card case is already covered by the
            sentence above, so repeating it here would just be saying it twice. */}
        {decision.card && (
          <p className="mt-2 font-mono text-[11.5px] text-mint-700">
            card ••••{decision.card.last4} · limit {money(decision.card.limitCents)} · expires{" "}
            {shortDate(decision.card.expiresAt)}
          </p>
        )}
      </div>

      {/* 3, the evidence */}
      <div className="flex items-baseline justify-between gap-3 border-b border-edge bg-ink-50/60 px-5 py-2">
        <p className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">
          The checks it had to pass
        </p>
        <p className="tabular font-mono text-[11.5px] text-ink-500">
          {passed} of {answered} · policy v{decision.ruleVersion}
        </p>
      </div>

      <ul className="divide-y divide-edge">
        {checks.map((c) => (
          <CheckRow key={c.ruleId} check={c} />
        ))}
      </ul>

      {/* The snapshot, not a pointer. This is what a replay re-judges. */}
      <details className="border-t border-edge px-5 py-2.5">
        <summary className="cursor-pointer text-[12px] text-muted hover:text-ink-900">
          For auditors: the record exactly as it was read, {record.observedAt.replace("T", " ").slice(0, 19)}
        </summary>
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
          Stored with the decision rather than looked up again later, so re-running this
          judges the facts as they were at the time, not as they are now.
        </p>
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-ink-50 p-3 font-mono text-[11px] leading-relaxed text-ink-600">
          {JSON.stringify(record, null, 2)}
        </pre>
      </details>
    </Panel>
  );
}
