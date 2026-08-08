"use client";

import { useState } from "react";
import type { Rule, RuleSet } from "@/lib/types";
import { Badge, Button, Panel } from "./ui";

/**
 * The rule editor.
 *
 * Every threshold on this screen is a row in a versioned table, and saving writes the
 * next version rather than editing the one in front of you. That is the difference
 * between a policy the customer owns and a policy that needs a deploy — and it is what
 * makes the replay next to it mean anything.
 *
 * The "anchored" badge is the one place Monad's purple appears, deliberately: it is the
 * one thing on screen that Monad's brand actually explains, a rule version anchored as a
 * real transaction, not a decorative accent reused everywhere.
 */

function ParamField({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number | boolean | string;
  onChange: (v: number | boolean | string) => void;
}) {
  if (typeof value === "boolean") {
    return (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3.5 w-3.5 accent-rain-500"
        />
        <span className="font-mono text-[11px] text-muted">{name}</span>
      </label>
    );
  }

  if (typeof value === "number") {
    return (
      <label className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-muted">{name}</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="tabular w-20 rounded-lg border border-edge bg-white px-1.5 py-0.5 text-right font-mono text-[11px] text-ink-900 outline-none focus:border-rain-400 focus:ring-2 focus:ring-rain-100"
        />
      </label>
    );
  }

  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-[11px] text-muted">{name}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-28 rounded-lg border border-edge bg-white px-1.5 py-0.5 font-mono text-[11px] text-ink-900 outline-none focus:border-rain-400 focus:ring-2 focus:ring-rain-100"
      />
    </label>
  );
}

export function RuleEditor({
  rules,
  ruleSets,
  current,
  dirty,
  busy,
  onChange,
  onPreview,
  onPropose,
  onActivate,
  onAnchor,
  onRevert,
  anchoringEnabled = false,
}: {
  rules: Rule[];
  ruleSets: RuleSet[];
  current: RuleSet;
  dirty: boolean;
  busy: boolean;
  onChange: (rules: Rule[]) => void;
  onPreview: () => void;
  onPropose: (proposedBy: string) => void;
  onActivate: (version: number, approvedBy: string) => void;
  onAnchor: (version: number) => void;
  onRevert: (version: number) => void;
  anchoringEnabled?: boolean;
}) {
  const [proposer, setProposer] = useState("");
  const [approver, setApprover] = useState("");
  const pending = ruleSets.find((r) => r.status === "pending");

  const update = (id: string, patch: Partial<Rule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <Panel
      title="Policy"
      right={
        <div className="flex items-center gap-2">
          <Badge tone={dirty ? "warn" : "neutral"}>
            {dirty ? "unsaved edit" : `v${current.version} active`}
          </Badge>
        </div>
      }
    >
      <ul className="divide-y divide-edge">
        {rules.map((rule, i) => (
          <li key={rule.id} className="px-4 py-2.5">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) => update(rule.id, { enabled: e.target.checked })}
                className="mt-1 h-3.5 w-3.5 accent-rain-500"
                title="Disable this rule"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={`text-[13px] font-medium ${
                      rule.enabled ? "text-ink-900" : "text-ink-400 line-through"
                    }`}
                  >
                    <span className="mr-1.5 font-mono text-[11px] text-ink-400">{i + 1}</span>
                    {rule.label}
                  </p>
                  <code className="shrink-0 font-mono text-[10px] text-ink-400">{rule.id}</code>
                </div>
                {/* The control this descends from. None of these rules were invented here,
                    and saying which established control each one implements is most of the
                    answer to "why should I trust software to spend my money?" — these are
                    the controls a finance team already runs, moved to before the money is
                    committed. Invisible until now: it was in the data and in the docs but
                    never on screen. */}
                {rule.basis && (
                  <p className="mt-0.5 text-[11.5px] leading-snug text-ink-400">{rule.basis}</p>
                )}
                {Object.keys(rule.params).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {Object.entries(rule.params).map(([k, v]) => (
                      <ParamField
                        key={k}
                        name={k}
                        value={v}
                        onChange={(nv) => update(rule.id, { params: { ...rule.params, [k]: nv } })}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2 border-t border-edge px-4 py-2.5">
        <Button onClick={onPreview} disabled={busy} variant="primary">
          Replay against history
        </Button>
        {pending ? (
          <span className="text-[12px] text-muted">
            v{pending.version} is waiting for approval — one change at a time.
          </span>
        ) : (
          <>
            <input
              value={proposer}
              onChange={(e) => setProposer(e.target.value)}
              placeholder="your name"
              className="w-32 rounded-lg border border-edge bg-white px-2 py-1 text-[12px] text-ink-900 outline-none focus:border-rain-400"
            />
            <Button
              onClick={() => onPropose(proposer.trim())}
              disabled={busy || !dirty || proposer.trim().length === 0}
              title="Saves as the next version, pending a second person's approval"
            >
              Propose v{current.version + 1}
            </Button>
          </>
        )}
      </div>

      {/* Dual control. Whoever can raise a threshold could otherwise approve anything,
          so the author of a change may not be the one who activates it. */}
      {pending && (
        <div className="space-y-2 border-t border-edge bg-rain-50/60 px-4 py-3">
          <p className="text-[12px] text-ink-900">
            <span className="font-semibold">v{pending.version} proposed by {pending.proposedBy}</span>
            {pending.note ? ` — ${pending.note}` : ""}
          </p>
          <p className="text-[12px] text-muted">
            It decides nothing until someone else activates it. {pending.proposedBy} cannot
            approve their own change.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={approver}
              onChange={(e) => setApprover(e.target.value)}
              placeholder="approver name"
              className="w-40 rounded-lg border border-edge bg-white px-2 py-1 text-[12px] text-ink-900 outline-none focus:border-rain-400"
            />
            <Button
              variant="primary"
              disabled={busy || approver.trim().length === 0}
              onClick={() => onActivate(pending.version, approver.trim())}
            >
              Activate v{pending.version}
            </Button>
          </div>
        </div>
      )}

      {/* Version history. The old version is still here, which is the point. */}
      <div className="border-t border-edge px-4 py-2.5">
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-400">
          versions
        </p>
        <ul className="space-y-1">
          {ruleSets.map((rs) => (
            <li key={rs.version} className="flex items-center gap-2 text-[12px]">
              <span
                className={`font-mono ${
                  rs.version === current.version ? "text-ink-900" : "text-muted"
                }`}
              >
                v{rs.version}
              </span>
              <span className="truncate text-muted">{rs.note}</span>
              <code
                className="ml-auto shrink-0 font-mono text-[10px] text-ink-400"
                title={[
                  `sha256 ${rs.hash}`,
                  `proposed by ${rs.proposedBy}`,
                  rs.approvedBy ? `approved by ${rs.approvedBy}` : "awaiting approval",
                  rs.anchorTxHash ? `Monad tx ${rs.anchorTxHash}` : "not yet anchored",
                ].join("\n")}
              >
                {rs.hash.slice(0, 10)}
              </code>
              {rs.status === "pending" ? (
                <Badge tone="warn">pending</Badge>
              ) : rs.anchorTxHash ? (
                <a
                  href={`https://testnet.monadexplorer.com/tx/${rs.anchorTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  title={rs.anchorTxHash}
                >
                  <Badge tone="monad">anchored on monad</Badge>
                </a>
              ) : anchoringEnabled ? (
                <button
                  type="button"
                  onClick={() => onAnchor(rs.version)}
                  disabled={busy}
                  className="rounded-full border border-monad-300 bg-monad-50 px-2 py-0.5 font-mono text-[10px] text-monad-700 transition hover:bg-monad-100 disabled:opacity-40"
                  title="Publish this version's hash to Monad testnet"
                >
                  anchor
                </button>
              ) : (
                <Badge tone="neutral">local</Badge>
              )}
              {rs.version !== current.version && (
                <button
                  type="button"
                  onClick={() => onRevert(rs.version)}
                  className="text-[11px] text-muted underline-offset-2 hover:text-ink-900 hover:underline"
                >
                  load
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
