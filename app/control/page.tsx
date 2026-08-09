"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Decision,
  PurchaseOrder,
  ReplayResult,
  Rule,
  RuleSet,
} from "@/lib/types";
import type { Stage } from "@/lib/pipeline";
import type { NegotiatedTask } from "@/lib/fixtures/tasks";
import { RunPanel } from "@/components/console/RunPanel";
import { NegotiationPanel } from "@/components/console/NegotiationPanel";
import { ProvenancePanel } from "@/components/console/ProvenancePanel";
import { RuleEditor } from "@/components/console/RuleEditor";
import { ReplayDiff } from "@/components/console/ReplayDiff";
import { PipelineDiagram } from "@/components/console/PipelineDiagram";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LoadingRain } from "@/components/layout/LoadingRain";
import { Badge } from "@/components/ui";
import { diffRules } from "@/lib/rules/diff";

interface State {
  storage: "memory" | "postgres";
  rain: { mode: "off" | "simulated" | "live"; reason?: string };
  anchoringEnabled: boolean;
  ephemeralInProduction: boolean;
  decisions: Decision[];
  ruleSets: RuleSet[];
  negotiatedTasks: NegotiatedTask[];
}

type Tab = "provenance" | "policy";

const STEP_DELAY_MS = 380;

/**
 * Minimum time the Raining… screen stays up.
 *
 * State usually returns in well under 100ms warm, and a loader that appears for 70ms
 * reads as a flicker rather than a loader — worse than not having one. This is a floor,
 * not a delay: if the data takes longer, the screen simply stays until it arrives.
 * Nothing waits on this timer except the animation being visible long enough to be seen.
 */
const MIN_LOADING_MS = 900;
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

  const [minLoadingDone, setMinLoadingDone] = useState(false);
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
    const t = setTimeout(() => setMinLoadingDone(true), MIN_LOADING_MS);
    return () => clearTimeout(t);
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
    body: { taskId?: string; po?: PurchaseOrder; agent?: string },
    taskId?: string
  ): Promise<Decision | null> {
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
      return decision;
    } catch (err) {
      setError((err as Error).message);
      setRacing(false);
      return null;
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

  /** Write the edit down as the next version — pending, deciding nothing yet. */
  async function propose(proposedBy: string) {
    if (!draftRules) return;
    setBusy(true);
    setError(null);
    try {
      await post("/api/rules", {
        rules: draftRules,
        note: "Edited in the console",
        proposedBy,
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Publish a version's hash to Monad, so it has a timestamp we do not control. */
  async function anchor(version: number) {
    setBusy(true);
    setError(null);
    try {
      await post("/api/anchor", { version });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** The second pair of eyes. Rejected server-side if it is the same person. */
  async function activate(version: number, approvedBy: string) {
    setBusy(true);
    setError(null);
    try {
      await post("/api/rules/activate", { version, approvedBy });
      const data = await load();
      // Now that it decides things, show it as the working copy.
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
      // Reset is the only destructive route, so production gates it behind a token. Ask
      // the presenter once and remember it — a judge never needs this button, and nobody
      // who merely found the URL should be able to wipe the demo mid-judging.
      let token = typeof window === "undefined" ? null : window.localStorage.getItem("demoToken");
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { "x-demo-token": token } : {}),
        },
      });
      if (res.status === 401) {
        token = window.prompt("Demo token, to reset the demo state:");
        if (!token) throw new Error("Reset cancelled.");
        window.localStorage.setItem("demoToken", token);
        const retry = await fetch("/api/reset", {
          method: "POST",
          headers: { "content-type": "application/json", "x-demo-token": token },
        });
        if (!retry.ok) {
          window.localStorage.removeItem("demoToken");
          throw new Error("That token was not accepted.");
        }
      } else if (!res.ok) {
        throw new Error(((await res.json()) as { error?: string }).error ?? "Reset failed.");
      }
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

  // An error should show immediately rather than sitting behind the animation.
  if (!state || !currentRuleSet || !draftRules || (!minLoadingDone && !error)) {
    return <LoadingRain error={error} />;
  }

  return (
    <div className="min-h-screen bg-white">
      <Header
        current="/control"
        storage={state.storage}
        rain={state.rain}
        ruleVersion={currentRuleSet.version}
        errorBadge={error ? <Badge tone="fail">{error}</Badge> : undefined}
      />

      <main className="mx-auto max-w-[1600px] px-6 py-8 md:px-10">
        <section className="mb-10">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-400">
              Live autonomous control path
            </p>
            <p className="text-[12.5px] text-muted">The console is the flight recorder, not an approval queue.</p>
          </div>

          {/* The one failure that works perfectly on a laptop and breaks on the deployed
              URL. Loud, because a quiet version of this warning is how it gets missed. */}
          {state.ephemeralInProduction && (
            <div className="mb-4 rounded-xl border border-danger-200 bg-danger-50 px-4 py-2.5 text-[13px] text-danger-700">
              <strong>No database is configured on this deployment.</strong> The decision
              log is in memory and will empty on the next cold start, which silently breaks
              replay. Set <code className="font-mono">DATABASE_URL</code> and redeploy.
            </div>
          )}

          <PipelineDiagram stages={stages} racing={racing} />
        </section>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* Dispatch is the only primary action. The system owns every step afterwards. */}
          <section className="flex flex-col gap-6">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-400">
              1 · Dispatch an agent
            </p>
            <RunPanel
              negotiatedTasks={state.negotiatedTasks}
              stages={stages}
              busy={busy}
              ranTasks={ranTasks}
              onRunNegotiated={(t) => run("/api/purchase", { taskId: t.id }, t.id)}
              onReset={reset}
            />
          </section>

          {/* The only two pieces of evidence a judge needs: why this run decided as it did,
              and what a policy change would have done to history. */}
          <section className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-400">
                2 · Inspect the proof
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
                  onPropose={propose}
                  onActivate={activate}
                  onAnchor={anchor}
                  anchoringEnabled={state.anchoringEnabled}
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

/**
 * The version that actually decides things: the highest **active** one.
 *
 * A pending version has a higher number but no authority — treating it as current would
 * show the console governing by a policy nobody has approved yet, which is exactly the
 * thing dual control exists to prevent.
 */
function latest(ruleSets: RuleSet[]): RuleSet {
  const active = ruleSets.filter((r) => r.status === "active");
  return (active.length ? active : ruleSets).reduce((a, b) =>
    b.version > a.version ? b : a
  );
}
