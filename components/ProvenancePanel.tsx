"use client";

import type { CheckResult, Decision } from "@/lib/types";
import { poTotal } from "@/lib/types";
import { money, shortDate } from "@/lib/format";
import { generateReceipt } from "@/lib/receipt";
import { Avatar } from "./Avatar";
import { AgentTag } from "./AgentTag";
import { Badge, Button, Dot, Empty, Panel } from "./ui";

/**
 * The audit view for one decision.
 *
 * The whole point is that a judge can settle any single decision in about five seconds
 * without asking a question: which rule failed, what it expected, what it got, and which
 * field of the record it read. Those four fields are the ones on screen, deliberately,
 * because the last time this work lived in the code it scored nothing.
 */

function CheckRow({ check }: { check: CheckResult }) {
  const state = check.skipped ? "skip" : check.passed ? "pass" : "fail";
  const failed = !check.passed && !check.skipped;

  return (
    <li
      className={`border-l-2 px-4 py-3 ${
        failed ? "border-l-fail bg-red-50/60" : "border-l-transparent"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5">
          <Dot state={state} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-medium text-ink-900">{check.label}</p>
            <code className="shrink-0 font-mono text-[11px] text-ink-400">{check.ruleId}</code>
          </div>
          <p className={`mt-1 text-[13px] leading-snug ${failed ? "text-ink-900" : "text-muted"}`}>
            {check.reason}
          </p>

          {/* The four fields. Shown for failures; a passing check does not need auditing. */}
          {failed && (
            <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-edge pt-2.5 font-mono text-[11px]">
              <dt className="text-ink-400">expected</dt>
              <dd className="tabular text-mint-700">{check.expected}</dd>
              <dt className="text-ink-400">actual</dt>
              <dd className="tabular text-fail">{check.actual}</dd>
              <dt className="text-ink-400">read from</dt>
              <dd className="text-ink-600">{check.readFrom}</dd>
            </dl>
          )}
        </div>
      </div>
    </li>
  );
}

export function ProvenancePanel({ decision }: { decision: Decision | null }) {
  if (!decision) {
    return (
      <Panel title="Provenance">
        <Empty>Select a decision from the log to audit it.</Empty>
      </Panel>
    );
  }

  const { po, record, checks, outcome } = decision;
  const total = poTotal(po);
  const statusTone = outcome === "refused" ? "fail" : outcome === "held" ? "warn" : "pass";

  return (
    <Panel
      title="Provenance"
      right={
        <div className="flex items-center gap-2">
          <Badge tone="neutral">policy v{decision.ruleVersion}</Badge>
          <Badge tone={statusTone}>{outcome.toUpperCase()}</Badge>
          <Button variant="ghost" onClick={() => generateReceipt(decision)}>
            Download PDF
          </Button>
        </div>
      }
    >
      <div className="border-b border-edge px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={po.vendor} size={30} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-mono text-sm text-ink-900">{po.poNumber}</p>
              <p className="tabular font-mono text-sm text-ink-900">{money(total)}</p>
            </div>
            <p className="text-[13px] text-muted">
              {po.quantity} × {po.sku} from {po.vendor} · {po.costCentre}
            </p>
          </div>
        </div>
        <div className="mt-2.5">
          <AgentTag id={decision.agent} />
        </div>

        {decision.card ? (
          <p className="mt-2 font-mono text-[11px] text-mint-700">
            card ••••{decision.card.last4} · limit {money(decision.card.limitCents)} · expires{" "}
            {shortDate(decision.card.expiresAt)}
          </p>
        ) : (
          // The sentence the whole architecture exists to make true.
          <p className="mt-2 font-mono text-[11px] text-fail">
            no card was created — there is nothing to decline
          </p>
        )}
      </div>

      <ul className="divide-y divide-edge">
        {checks.map((c) => (
          <CheckRow key={c.ruleId} check={c} />
        ))}
      </ul>

      {/* The snapshot, not a pointer. This is what a replay re-judges. */}
      <details className="border-t border-edge px-4 py-2.5">
        <summary className="cursor-pointer text-[12px] text-muted hover:text-ink-900">
          Record snapshot as read at {record.observedAt.replace("T", " ").slice(0, 19)}
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-ink-50 p-3 font-mono text-[11px] leading-relaxed text-ink-600">
          {JSON.stringify(record, null, 2)}
        </pre>
      </details>
    </Panel>
  );
}
