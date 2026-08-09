"use client";

import { useMemo, useState } from "react";
import type { CheckResult, Decision, PurchaseOrder, Rule } from "@/lib/types";
import { poTotal } from "@/lib/types";
import { money } from "@/lib/format";
import { Badge, Button, Panel } from "../ui";
import { ScanToAttack } from "./ScanToAttack";
import { CHALLENGER, type ChallengeStats } from "@/lib/challenge";

/**
 * Beat the checks — hand the judge the attack.
 *
 * Every other part of this console shows the system working. This one invites you to break
 * it, which is a different and much stronger claim: a judge who tries to get money out and
 * fails believes the thing far more than one who watches a scripted run succeed.
 *
 * It is also the honest shape of the problem. An agent under pressure to complete its task
 * is a player with every incentive to defect, and the interesting defections are not lies —
 * splitting a purchase to duck an approval limit is a strategy in which every individual
 * line is true. The answer is not a cleverer incentive, it is that defection is
 * mechanically visible.
 *
 * **What counts as a defeat.** Not "did something get refused" — a refusal is the check
 * doing its job. A check is defeated only if a card comes out the other side for an order
 * that does not match the record. That is a deliberately hard bar, and it is the only one
 * worth counting.
 */

interface Attempt {
  id: number;
  label: string;
  po: PurchaseOrder;
  outcome: Decision["outcome"];
  /** Checks that stopped it. */
  caughtBy: CheckResult[];
  /** True when a card was issued for an order that deviates from the record. */
  defeat: boolean;
}

/** Preset attacks. Each one teaches a different check faster than guessing would. */
function attacks(base: PurchaseOrder): { label: string; hint: string; po: PurchaseOrder }[] {
  return [
    {
      label: "Switch the supplier",
      hint: "Right item, right price, a vendor who never quoted it",
      po: { ...base, vendor: "Halloway Trading" },
    },
    {
      label: "Swap the item",
      hint: "Right supplier, right total, wrong thing in the box",
      po: { ...base, sku: `${base.sku}-X` },
    },
    {
      label: "Skim the price",
      hint: "A few percent over the quote — small enough to miss",
      po: { ...base, unitPrice: Math.round(base.unitPrice * 1.06) },
    },
    {
      label: "Invent the order",
      hint: "A purchase order the record has never heard of",
      po: { ...base, poNumber: "PO-99999" },
    },
    {
      label: "Inflate the quantity",
      hint: "Order far more than was quoted — and find the quote pins quantity too",
      po: { ...base, quantity: Math.max(1, Math.ceil(3_000_000 / base.unitPrice)) },
    },
    {
      label: "Resubmit the same order",
      hint: "The honest order, twice. A retry must not become a second card.",
      po: { ...base },
    },
  ];
}

/**
 * The split attack, which needs two requests rather than one.
 *
 * Both halves are genuine accepted quotes and each sits comfortably under the delegated
 * limit, so there is nothing false to catch. Only the running total on the same vendor and
 * cost centre gives it away — which is the whole argument for reading the pattern instead
 * of the move.
 */
const SPLIT: { label: string; hint: string; halves: PurchaseOrder[] } = {
  label: "Split it to duck approval",
  hint: "$37,700 of conveyor raised as two honest halves of $18,850",
  halves: [
    {
      poNumber: "PO-4424-A",
      vendor: "Bellweather Industrial",
      sku: "BW-CONV-90",
      unitPrice: 145_000,
      quantity: 13,
      quoteExpiry: "2026-09-30T23:59:59.000Z",
      costCentre: "CC-ENG",
    },
    {
      poNumber: "PO-4424-B",
      vendor: "Bellweather Industrial",
      sku: "BW-CONV-90",
      unitPrice: 145_000,
      quantity: 13,
      quoteExpiry: "2026-09-30T23:59:59.000Z",
      costCentre: "CC-ENG",
    },
  ],
};

function ScoreTile({ value, label, tone }: { value: string; label: string; tone: "zero" | "count" }) {
  return (
    <div
      className={`flex-1 rounded-xl border px-3 py-3 text-center ${
        tone === "zero"
          ? "border-mint-200 bg-mint-50 text-mint-700"
          : "border-edge bg-ink-50 text-ink-600"
      }`}
    >
      <div className="tabular font-mono text-3xl font-semibold leading-none">{value}</div>
      <div className="mt-1.5 text-[10px] uppercase leading-tight tracking-wider opacity-80">
        {label}
      </div>
    </div>
  );
}

export function ChallengePanel({
  blankPO,
  rules,
  stats,
  busy,
  onAttempt,
}: {
  blankPO: PurchaseOrder;
  rules: Rule[];
  /** Shared across everyone hitting this deployment, derived from the decision log. */
  stats: ChallengeStats;
  busy: boolean;
  onAttempt: (po: PurchaseOrder, agent?: string) => Promise<Decision>;
}) {
  const [draft, setDraft] = useState<PurchaseOrder>(blankPO);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [nextId, setNextId] = useState(1);

  const enabledRules = useMemo(() => rules.filter((r) => r.enabled), [rules]);

  /** Which checks have actually stopped something during this session. */
  const triggered = useMemo(() => {
    const s = new Set<string>();
    for (const a of attempts) for (const c of a.caughtBy) s.add(c.ruleId);
    return s;
  }, [attempts]);

  const defeats = attempts.filter((a) => a.defeat).length;

  async function fire(po: PurchaseOrder, label: string, agent = CHALLENGER) {
    const decision = await onAttempt(po, agent);
    const caughtBy = decision.checks.filter((c) => !c.passed);

    // A card came out for an order that does not match what was quoted. That, and only
    // that, is a defeat — being refused means the check worked.
    const deviates =
      po.vendor !== blankPO.vendor ||
      po.sku !== blankPO.sku ||
      po.unitPrice !== blankPO.unitPrice ||
      po.poNumber !== blankPO.poNumber;
    const defeat = decision.outcome === "approved" && deviates;

    setAttempts((prev) => [
      { id: nextId, label, po, outcome: decision.outcome, caughtBy, defeat },
      ...prev,
    ]);
    setNextId((n) => n + 1);
  }

  const field = (key: keyof PurchaseOrder, label: string, type: "text" | "number" = "text") => (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">{label}</span>
      <input
        type={type}
        value={String(draft[key])}
        onChange={(e) =>
          setDraft({ ...draft, [key]: type === "number" ? Number(e.target.value) : e.target.value })
        }
        className="w-full rounded-lg border border-edge bg-white px-2 py-1 font-mono text-[12px] text-ink-900 outline-none focus:border-rain-400 focus:ring-2 focus:ring-rain-100"
      />
    </label>
  );

  return (
    <Panel
      title="Beat the checks"
      right={
        <Badge tone={defeats > 0 ? "fail" : "neutral"}>
          {attempts.length} attempt{attempts.length === 1 ? "" : "s"}
        </Badge>
      }
    >
      <p className="border-b border-edge px-4 py-3 text-[13px] leading-relaxed text-ink-900">
        Try to get money out. Here is a purchase order that would pass, and{" "}
        <strong>{enabledRules.length} checks</strong> between you and a card. Change
        anything you like, or take one of the shortcuts below. A check only counts as
        defeated if a card is <em>issued</em> for an order that does not match the record —
        being refused means it worked.
      </p>

      <div className="border-b border-edge px-4 py-4">
        <ScanToAttack stats={stats} />
      </div>

      <div className="flex gap-2 px-4 py-3">
        <ScoreTile value={String(defeats)} label="defeated in this tab" tone="zero" />
        <ScoreTile
          value={`${triggered.size}/${enabledRules.length}`}
          label="checks you've run into"
          tone="count"
        />
      </div>

      {/* The board. Every check is listed whether or not you have found it yet, because
          the point is that the surface is knowable and still holds. */}
      <ul className="grid grid-cols-1 gap-1 border-t border-edge px-4 py-3 sm:grid-cols-2">
        {enabledRules.map((rule) => {
          const hit = triggered.has(rule.id);
          return (
            <li
              key={rule.id}
              className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-[12px] ${
                hit ? "bg-mint-50 text-mint-700" : "text-ink-400"
              }`}
            >
              <span className="mt-0.5 shrink-0 font-mono text-[10px]">{hit ? "✓" : "·"}</span>
              <span className={hit ? "font-medium" : ""}>{rule.label}</span>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-edge px-4 py-3">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-500">
          shortcuts
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={busy}
            title={SPLIT.hint}
            onClick={async () => {
              // First half on its own is honest and goes through. The second is what the
              // structuring rule is for — the demo only works if both are fired.
              await fire(SPLIT.halves[0], `${SPLIT.label} — first half`, "procurement-02");
              await fire(SPLIT.halves[1], `${SPLIT.label} — second half`, "procurement-02");
            }}
            className="rounded-full border border-rain-200 bg-rain-50 px-2.5 py-1 text-[12px] font-medium text-rain-700 transition hover:border-rain-300 hover:bg-rain-100 disabled:opacity-40"
          >
            {SPLIT.label}
          </button>
          {attacks(blankPO).map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={busy}
              title={a.hint}
              onClick={() => {
                setDraft(a.po);
                fire(a.po, a.label);
              }}
              className="rounded-full border border-edge bg-white px-2.5 py-1 text-[12px] text-ink-700 transition hover:border-rain-300 hover:bg-rain-50 disabled:opacity-40"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-edge px-4 py-3">
        <div className="grid grid-cols-2 gap-2.5">
          {field("poNumber", "po number")}
          {field("vendor", "vendor")}
          {field("sku", "sku")}
          {field("costCentre", "cost centre")}
          {field("unitPrice", "unit price (cents)", "number")}
          {field("quantity", "quantity", "number")}
        </div>
        <div className="flex items-center justify-between">
          <span className="tabular font-mono text-[12px] text-ink-500">
            total {money(poTotal(draft))}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDraft(blankPO)} disabled={busy}>
              Reset order
            </Button>
            <Button variant="primary" onClick={() => fire(draft, "Your order")} disabled={busy}>
              Try to get a card
            </Button>
          </div>
        </div>
      </div>

      {attempts.length > 0 && (
        <div className="max-h-72 overflow-y-auto border-t border-edge">
          {attempts.map((a) => (
            <div key={a.id} className="border-b border-edge/60 px-4 py-2.5 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[12.5px] text-ink-900">{a.label}</span>
                <span
                  className={`shrink-0 font-mono text-[11px] ${
                    a.defeat
                      ? "text-fail"
                      : a.outcome === "approved"
                        ? "text-ink-500"
                        : "text-mint-700"
                  }`}
                >
                  {a.defeat
                    ? "DEFEATED A CHECK"
                    : a.outcome === "approved"
                      ? "issued — this order was honest"
                      : a.outcome === "held"
                        ? "held for a person"
                        : "stopped"}
                </span>
              </div>
              {a.caughtBy.map((c) => (
                <p key={c.ruleId} className="mt-0.5 text-[12px] text-muted">
                  <span className="text-ink-700">{c.label}</span> — {c.reason}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      <p className="border-t border-edge px-4 py-2.5 text-[11px] leading-relaxed text-muted">
        Splitting a purchase to duck an approval limit is not a lie — every line is true.
        That is why one of these checks looks at the <em>pattern</em> rather than the move.
      </p>
    </Panel>
  );
}
