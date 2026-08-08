"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  BudgetRecord,
  Decision,
  PurchaseOrder,
  ReplayResult,
  Rule,
  RuleSet,
} from "@/lib/types";
import type { Stage } from "@/lib/pipeline";
import type { NegotiatedTask, Task } from "@/lib/fixtures/tasks";
import { RunPanel } from "@/components/RunPanel";
import { NegotiationPanel } from "@/components/NegotiationPanel";
import { DecisionFeed } from "@/components/DecisionFeed";
import { ProvenancePanel } from "@/components/ProvenancePanel";
import { RuleEditor } from "@/components/RuleEditor";
import { ReplayDiff } from "@/components/ReplayDiff";
import { BudgetMeter } from "@/components/BudgetMeter";
import { PipelineDiagram } from "@/components/PipelineDiagram";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui";
import { diffRules } from "@/lib/rules/diff";

interface State {
  storage: "memory" | "postgres";
  rainWired: boolean;
  decisions: Decision[];
  ruleSets: RuleSet[];
  budgets: BudgetRecord[];
  negotiatedTasks: NegotiatedTask[];
  tasks: Task[];
  blankPO: PurchaseOrder;
}

type Tab = "provenance" | "policy";

const STEP_DELAY_MS = 380;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Page() {
  const [state, setState] = useState<State | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [racing, setRacing] = useState(false);
  const [ranTasks, setRanTasks] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("provenance");

  const [draftRules, setDraftRules] = useState<Rule[] | null>(null);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    const data: State = await res.json();
    setState(data);
    setDraftRules((prev) => prev ?? latest(data.ruleSets).rules);
    return data;
  }, []);

  useEffect(() => {
    load()
      .then((data) => {
        // Land on the most recent decision rather than an empty panel. On a fresh reset
        // that is the newest seeded row, so the audit view is never blank on arrival.
        setSelectedId((prev) => prev ?? data.decisions[0]?.id ?? null);
      })
      .catch(() => setError("Could not load state."));
  }, [load]);

  const currentRuleSet = useMemo(
    () => (state ? latest(state.ruleSets) : null),
    [state]
  );

  const dirty = useMemo(() => {
    if (!currentRuleSet || !draftRules) return false;
    return JSON.stringify(draftRules) !== JSON.stringify(currentRuleSet.rules);
  }, [draftRules, currentRuleSet]);

  const selected = useMemo(
    () => state?.decisions.find((d) => d.id === selectedId) ?? null,
    [state, selectedId]
  );

  // --- actions -------------------------------------------------------------

  async function post<T>(url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed.");
    return data as T;
  }

  async function run(
    url: "/api/run" | "/api/purchase",
    body: { taskId?: string; po?: PurchaseOrder },
    taskId?: string
  ) {
    setBusy(true);
    setRacing(true);
    setError(null);
    setStages([]);
    try {
      // The full result comes back in one call — it's fast and deterministic. What
      // follows is an honest, choreographed reveal of that same real result, one step at
      // a time, not a second slower computation. The numbers never change; only the pace
      // of showing them does, so watching it is closer to watching it happen.
      const { decision, stages: next } = await post<{ decision: Decision; stages: Stage[] }>(
        url,
        body
      );
      for (let i = 0; i < next.length; i++) {
        setStages(next.slice(0, i + 1));
        if (i < next.length - 1) await sleep(STEP_DELAY_MS);
      }
      setRacing(false);
      if (taskId) setRanTasks((prev) => new Set(prev).add(taskId));
      await load();
      // Jump straight to the decision that was just made — in the demo this is what
      // puts the refusal and its four provenance fields on screen with no clicking.
      setSelectedId(decision.id);
      setTab("provenance");
    } catch (err) {
      setError((err as Error).message);
      setRacing(false);
    } finally {
      setBusy(false);
    }
  }

  async function preview() {
    if (!draftRules) return;
    setBusy(true);
    setError(null);
    try {
      const { result } = await post<{ result: ReplayResult }>("/api/replay", {
        rules: draftRules,
      });
      setReplayResult(result);
      setTab("policy");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draftRules) return;
    setBusy(true);
    setError(null);
    try {
      await post("/api/rules", { rules: draftRules, note: "Edited in the console" });
      const data = await load();
      setDraftRules(latest(data.ruleSets).rules);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await post("/api/reset");
      const data = await load();
      setDraftRules(latest(data.ruleSets).rules);
      setStages([]);
      setRanTasks(new Set());
      setSelectedId(null);
      setReplayResult(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!state || !currentRuleSet || !draftRules) {
    return (
      <main className="flex h-screen items-center justify-center text-[13px] text-muted">
        {error ?? "Loading…"}
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header
        storage={state.storage}
        rainWired={state.rainWired}
        ruleVersion={currentRuleSet.version}
        errorBadge={error ? <Badge tone="fail">{error}</Badge> : undefined}
      />

      <main className="mx-auto max-w-[1600px] px-6 py-8 md:px-10">
        <section className="mb-10">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">
            1 · How it works
          </p>
          <PipelineDiagram stages={stages} racing={racing} />
        </section>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* left: what the agents did, and the append-only record of it */}
          <section className="flex flex-col gap-6">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-400">
              2 · Run it
            </p>
            <RunPanel
              negotiatedTasks={state.negotiatedTasks}
              tasks={state.tasks}
              blankPO={state.blankPO}
              stages={stages}
              busy={busy}
              ranTasks={ranTasks}
              onRunNegotiated={(t) => run("/api/purchase", { taskId: t.id }, t.id)}
              onRunTask={(t) => run("/api/run", { taskId: t.id }, t.id)}
              onRunPO={(po) => run("/api/run", { po })}
              onReset={reset}
            />
            <DecisionFeed
              decisions={state.decisions}
              selectedId={selectedId}
              onSelect={(d) => {
                setSelectedId(d.id);
                setTab("provenance");
              }}
            />
          </section>

          {/* right: audit one decision, or change the policy and re-judge all of them */}
          <section className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-400">
                3 · Audit it
              </p>
              <nav className="flex gap-1.5 rounded-full border border-edge bg-ink-50 p-1">
                {(["provenance", "policy"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium capitalize transition ${
                      tab === t
                        ? "bg-white text-rain-700 shadow-sm"
                        : "text-muted hover:text-ink-900"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </nav>
            </div>

            {tab === "provenance" ? (
              <>
                {/* Where this PO's price came from, when it came from a negotiation. */}
                {selected?.negotiation && (
                  <NegotiationPanel
                    negotiation={selected.negotiation}
                    poNumber={selected.po.poNumber}
                    totalCents={selected.po.unitPrice * selected.po.quantity}
                  />
                )}
                <ProvenancePanel decision={selected} />
                <BudgetMeter budgets={state.budgets} />
              </>
            ) : (
              <>
                <RuleEditor
                  rules={draftRules}
                  ruleSets={state.ruleSets}
                  current={currentRuleSet}
                  dirty={dirty}
                  busy={busy}
                  onChange={setDraftRules}
                  onPreview={preview}
                  onSave={save}
                  onRevert={(v) => {
                    const rs = state.ruleSets.find((r) => r.version === v);
                    if (rs) setDraftRules(rs.rules);
                  }}
                />
                <ReplayDiff
                  result={replayResult}
                  ruleChanges={diffRules(currentRuleSet.rules, draftRules)}
                  onSelectDecision={(id) => {
                    setSelectedId(id);
                    setTab("provenance");
                  }}
                />
              </>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function latest(ruleSets: RuleSet[]): RuleSet {
  return ruleSets.reduce((a, b) => (b.version > a.version ? b : a));
}
