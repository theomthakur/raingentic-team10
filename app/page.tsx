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
import type { Task } from "@/lib/fixtures/tasks";
import { RunPanel } from "@/components/RunPanel";
import { DecisionFeed } from "@/components/DecisionFeed";
import { ProvenancePanel } from "@/components/ProvenancePanel";
import { RuleEditor } from "@/components/RuleEditor";
import { ReplayDiff } from "@/components/ReplayDiff";
import { BudgetMeter } from "@/components/BudgetMeter";
import { PipelineDiagram } from "@/components/PipelineDiagram";
import { Badge } from "@/components/ui";

interface State {
  storage: "memory" | "postgres";
  rainWired: boolean;
  decisions: Decision[];
  ruleSets: RuleSet[];
  budgets: BudgetRecord[];
  tasks: Task[];
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
    load().catch(() => setError("Could not load state."));
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

  async function run(body: { taskId?: string; po?: PurchaseOrder }, taskId?: string) {
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
        "/api/run",
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
    <main className="mx-auto flex h-screen max-w-[1600px] flex-col gap-3 p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">Mandate</h1>
          <p className="text-[13px] text-muted">
            An agent wants to spend money.{" "}
            <span className="text-ink-700">Click a task below and watch what happens.</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error && <Badge tone="fail">{error}</Badge>}
          <Badge tone={state.storage === "postgres" ? "pass" : "warn"}>
            {state.storage === "postgres" ? "postgres" : "in-memory"}
          </Badge>
          <Badge tone={state.rainWired ? "rain" : "neutral"}>
            {state.rainWired ? "rain live" : "rain simulated"}
          </Badge>
          <Badge tone="neutral">policy v{currentRuleSet.version}</Badge>
        </div>
      </header>

      <PipelineDiagram stages={stages} racing={racing} />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* left: what the agents did, and the append-only record of it */}
        <div className="flex min-h-0 flex-col gap-3">
          <RunPanel
            tasks={state.tasks}
            stages={stages}
            busy={busy}
            ranTasks={ranTasks}
            onRunTask={(t) => run({ taskId: t.id }, t.id)}
            onRunPO={(po) => run({ po })}
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
        </div>

        {/* right: audit one decision, or change the policy and re-judge all of them */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <nav className="flex gap-1">
            {(["provenance", "policy"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium capitalize transition ${
                  tab === t
                    ? "border-rain-200 bg-rain-50 text-rain-700"
                    : "border-transparent text-muted hover:text-ink-900"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>

          {tab === "provenance" ? (
            <>
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
              <ReplayDiff result={replayResult} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function latest(ruleSets: RuleSet[]): RuleSet {
  return ruleSets.reduce((a, b) => (b.version > a.version ? b : a));
}
