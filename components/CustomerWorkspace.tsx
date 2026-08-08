"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BudgetRecord, Decision, RuleSet } from "@/lib/types";
import { money, shortDate, shortTime } from "@/lib/format";
import { departmentName, outcomeSummary, productName } from "@/lib/plain";
import { getAgent } from "@/lib/agents";
import { Avatar } from "@/components/Avatar";
import { SubPageHeader } from "@/components/SiteNav";
import { Badge, Button, Empty, Panel } from "@/components/ui";
import { LoadingRain } from "@/components/LoadingRain";

interface WorkspaceState {
  storage: "memory" | "postgres";
  rain: { mode: "off" | "simulated" | "live"; reason?: string };
  ephemeralInProduction: boolean;
  decisions: Decision[];
  budgets: BudgetRecord[];
  ruleSets: RuleSet[];
}

/**
 * The customer-facing home is deliberately not a second audit console.
 *
 * A controller needs to answer three questions before learning any system vocabulary:
 * what needs my attention, what is safe to ignore, and what happens if I act. The
 * existing home remains the Operations view for demonstrating agents, controls and raw
 * provenance. This workspace is the calmer surface a finance customer would open daily.
 */
export function CustomerWorkspace() {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const [approver, setApprover] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/state", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load your spending workspace.");
    setState(data as WorkspaceState);
  }, []);

  useEffect(() => {
    load().catch((err) => setError((err as Error).message));
  }, [load]);

  const released = useMemo(
    () => new Set(state?.decisions.map((decision) => decision.releases).filter(Boolean) as string[]),
    [state]
  );
  const pending = useMemo(
    () => state?.decisions.filter((decision) => decision.outcome === "held" && !released.has(decision.id)) ?? [],
    [state, released]
  );
  const recent = useMemo(() => state?.decisions.slice(0, 6) ?? [], [state]);
  const protectedToday = useMemo(
    () => state?.decisions.filter((decision) => !decision.seeded && decision.outcome === "refused").length ?? 0,
    [state]
  );
  const awaitingCents = useMemo(
    () => pending.reduce((sum, decision) => sum + decision.po.unitPrice * decision.po.quantity, 0),
    [pending]
  );
  const tightBudgets = useMemo(
    () => state?.budgets.filter((budget) => budget.spentCents / budget.limitCents >= 0.85) ?? [],
    [state]
  );

  async function approve(decisionId: string) {
    if (!approver.trim()) {
      setError("Add the name of the person accepting responsibility.");
      return;
    }
    setBusyId(decisionId);
    setError(null);
    try {
      const response = await fetch("/api/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decisionId, by: approver.trim(), note: note.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "This request could not be approved.");
      setApprovalId(null);
      setApprover("");
      setNote("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (!state) return <LoadingRain error={error} />;

  const latestPolicy = state.ruleSets
    .filter((ruleSet) => ruleSet.status === "active")
    .reduce((latest, ruleSet) => (ruleSet.version > latest.version ? ruleSet : latest));

  return (
    <div className="min-h-screen bg-[#f8fafc] text-ink-900">
      {/* The same bar as every other page. This used to be a second, bespoke nav whose
          links went nowhere else in the site, so the workspace was effectively a separate
          little app that happened to share a domain. */}
      <SubPageHeader current="/workspace" />

      {/* Sections within this page, kept as their own row so they read as a level below
          the site nav rather than competing with it. */}
      <div className="border-b border-edge bg-ink-50">
        <nav className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-2 px-6 py-2.5 text-[13px] font-medium text-muted md:px-10">
          <span className="text-[11px] uppercase tracking-wider text-ink-400">On this page</span>
          <a className="text-ink-900" href="#overview">Overview</a>
          <a href="#approvals">Approvals{pending.length ? ` (${pending.length})` : ""}</a>
          <a href="#activity">Activity</a>
          <a href="#budgets">Budgets</a>
        </nav>
      </div>

      <main className="mx-auto max-w-[1440px] px-6 py-8 md:px-10">
        {state.ephemeralInProduction && (
          <div className="mb-6 rounded-2xl border border-fail/25 bg-red-50 px-5 py-4 text-[13px] text-fail">
            This workspace needs its database connected before it can be used reliably. Activity and approvals will not persist after a server restart.
          </div>
        )}
        {error && <div className="mb-6 rounded-2xl border border-fail/25 bg-red-50 px-5 py-4 text-[13px] text-fail">{error}</div>}

        <section id="overview" className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wider text-rain-600">Spending overview</p>
            <h1 className="mt-1 font-display text-[32px] font-medium tracking-[-0.03em] text-ink-900">Good morning, Princy.</h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">Your agents are working within the rules you set. Here is what needs a person today.</p>
          </div>
          <Link href="#approvals"><Button variant={pending.length ? "primary" : "default"}>{pending.length ? `Review ${pending.length} approvals` : "No approvals waiting"}</Button></Link>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Spending summary">
          <SummaryCard label="Needs your approval" value={String(pending.length)} detail={pending.length ? `${money(awaitingCents)} waiting for a decision` : "Nothing is waiting on you"} tone={pending.length ? "warn" : "pass"} />
          <SummaryCard label="Protected this session" value={String(protectedToday)} detail="Requests stopped before a card was created" tone="pass" />
          <SummaryCard label="Budgets to watch" value={String(tightBudgets.length)} detail={tightBudgets.length ? tightBudgets.map((budget) => departmentName(budget.costCentre)).join(", ") : "All departments have room to spend"} tone={tightBudgets.length ? "warn" : "pass"} />
          <SummaryCard label="Spending rules" value={`v${latestPolicy.version}`} detail="Active policy, reviewed before every purchase" tone="neutral" />
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
          <section id="approvals">
            <Panel title="Requests that need your approval" right={<Badge tone={pending.length ? "warn" : "pass"}>{pending.length ? `${pending.length} waiting` : "All clear"}</Badge>}>
              {pending.length === 0 ? <Empty>Everything is within delegated authority. Nothing needs your approval right now.</Empty> : (
                <ul className="divide-y divide-edge">
                  {pending.map((decision) => {
                    const total = decision.po.unitPrice * decision.po.quantity;
                    const agent = getAgent(decision.agent);
                    const isOpen = approvalId === decision.id;
                    return <li key={decision.id} className="px-5 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3">
                          <Avatar name={decision.po.vendor} size={38} />
                          <div>
                            <p className="text-[15px] font-semibold text-ink-900">{decision.po.quantity} × {productName(decision.po.sku)}</p>
                            <p className="mt-1 text-[13px] text-muted">{decision.po.vendor} · requested by {agent.name} for {departmentName(decision.po.costCentre)}</p>
                          </div>
                        </div>
                        <p className="tabular text-[18px] font-semibold text-ink-900">{money(total)}</p>
                      </div>
                      <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-warn">
                        <strong>This request is within policy, but above {agent.name}&apos;s delegated authority.</strong> No payment card exists until a named person approves it.
                      </div>
                      {isOpen ? <div className="mt-4 grid gap-3 rounded-xl border border-edge bg-ink-50 p-4 md:grid-cols-[1fr_1fr_auto]">
                        <label className="text-[12px] font-medium text-ink-700">Your name<input value={approver} onChange={(event) => setApprover(event.target.value)} placeholder="e.g. Princy Doshi" className="mt-1.5 w-full rounded-lg border border-edge bg-white px-3 py-2 text-[13px] outline-none focus:border-rain-400" /></label>
                        <label className="text-[12px] font-medium text-ink-700">Note (optional)<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why this purchase can proceed" className="mt-1.5 w-full rounded-lg border border-edge bg-white px-3 py-2 text-[13px] outline-none focus:border-rain-400" /></label>
                        <div className="flex items-end gap-2"><Button variant="ghost" onClick={() => setApprovalId(null)}>Cancel</Button><Button variant="primary" disabled={busyId === decision.id} onClick={() => approve(decision.id)}>{busyId === decision.id ? "Approving…" : "Approve purchase"}</Button></div>
                      </div> : <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-[12.5px] text-muted">The records are checked again immediately before payment is authorized.</p><Button onClick={() => setApprovalId(decision.id)}>Review and approve</Button></div>}
                    </li>;
                  })}
                </ul>
              )}
            </Panel>
          </section>

          <section id="budgets" className="space-y-6">
            <Panel title="Department budgets">
              <ul className="divide-y divide-edge">
                {state.budgets.map((budget) => <BudgetRow key={budget.costCentre} budget={budget} />)}
              </ul>
            </Panel>
            <Panel title="How Mandate keeps payments safe">
              <div className="space-y-3 px-5 py-4 text-[13px] leading-relaxed text-muted">
                <p><strong className="text-ink-900">Agents can propose.</strong> They cannot decide whether money moves.</p>
                <p><strong className="text-ink-900">Every request is checked first.</strong> A mismatch means no card is ever created.</p>
                <Link href="/" className="inline-block font-medium text-rain-600 hover:text-rain-700">See controls and audit evidence →</Link>
              </div>
            </Panel>
          </section>
        </div>

        <section id="activity" className="mt-8">
          <Panel title="Recent spending activity" right={<Link href="/" className="text-[12.5px] font-medium text-rain-600 hover:text-rain-700">View full audit trail →</Link>}>
            <ul className="divide-y divide-edge">
              {recent.map((decision) => <ActivityRow key={decision.id} decision={decision} />)}
            </ul>
          </Panel>
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "pass" | "warn" | "neutral" }) {
  const accent = tone === "warn" ? "border-amber-200 bg-amber-50/60" : tone === "pass" ? "border-mint-500/25 bg-white" : "border-edge bg-white";
  return <section className={`rounded-2xl border p-5 shadow-sm shadow-ink-900/[0.025] ${accent}`}><p className="text-[12px] font-semibold uppercase tracking-wider text-muted">{label}</p><p className="mt-3 font-display text-[30px] font-medium tracking-[-0.03em] text-ink-900">{value}</p><p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{detail}</p></section>;
}

function BudgetRow({ budget }: { budget: BudgetRecord }) {
  const used = budget.limitCents ? budget.spentCents / budget.limitCents : 0;
  const remaining = budget.limitCents - budget.spentCents;
  const tight = used >= 0.85;
  return <li className="px-5 py-3.5"><div className="flex items-baseline justify-between gap-3"><span className="text-[13.5px] font-medium text-ink-900">{departmentName(budget.costCentre)}</span><span className="tabular text-[13px] font-semibold text-ink-900">{money(remaining)} left</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100"><div className={tight ? "h-full rounded-full bg-warn" : "h-full rounded-full bg-mint-500"} style={{ width: `${Math.min(100, used * 100)}%` }} /></div><p className="mt-1.5 text-[11.5px] text-muted">{money(budget.spentCents)} of {money(budget.limitCents)} used{tight ? " · needs attention" : ""}</p></li>;
}

function ActivityRow({ decision }: { decision: Decision }) {
  const total = decision.po.unitPrice * decision.po.quantity;
  const firstFailure = decision.checks.find((check) => !check.passed && !check.skipped);
  const outcome = outcomeSummary(decision.outcome);
  const tone = decision.outcome === "approved" ? "pass" : decision.outcome === "held" ? "warn" : "fail";
  return <li className="flex flex-wrap items-center gap-3 px-5 py-4"><Avatar name={decision.po.vendor} size={34} /><div className="min-w-[220px] flex-1"><p className="text-[13.5px] font-medium text-ink-900">{decision.po.quantity} × {productName(decision.po.sku)} <span className="font-normal text-muted">from {decision.po.vendor}</span></p><p className="mt-0.5 text-[12px] text-muted">{decision.outcome === "refused" && firstFailure ? firstFailure.reason : outcome.meaning}</p></div><div className="text-right"><p className="tabular text-[13.5px] font-semibold text-ink-900">{money(total)}</p><p className="mt-0.5 text-[11px] text-ink-400">{decision.seeded ? shortDate(decision.createdAt) : shortTime(decision.createdAt)}</p></div><Badge tone={tone}>{outcome.label}</Badge></li>;
}
