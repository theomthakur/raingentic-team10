"use client";

import type { Stage } from "@/lib/pipeline";

/**
 * The architecture, always on screen, lighting up as a real run passes through it.
 *
 * The diagram is the pitch: someone should be able to point at this and understand the
 * whole system before anyone says a word, and then watch it actually happen when a task
 * runs. A static architecture slide claims the stages exist; this one demonstrates them.
 */

interface Node {
  key: Stage["name"];
  n: number;
  label: string;
  hint: string;
}

const PROPOSE: Node = { key: "PROPOSE", n: 1, label: "Propose", hint: "agent declares the deal" };
const VERIFY: Node = { key: "VERIFY", n: 2, label: "Verify", hint: "checked against the record" };
const ISSUE: Node = { key: "ISSUE", n: 3, label: "Issue", hint: "Rain issues a scoped card" };
const REFUSE: Node = { key: "REFUSE", n: 3, label: "Refuse", hint: "no card is ever created" };
const HOLD: Node = { key: "HOLD", n: 3, label: "Hold", hint: "waiting on a person" };
const SETTLE: Node = { key: "SETTLE", n: 4, label: "Settle", hint: "the purchase happens" };
const REVOKE: Node = { key: "REVOKE", n: 5, label: "Revoke", hint: "the card is retired" };
const RECORD: Node = { key: "RECORD", n: 6, label: "Record", hint: "written, append-only" };

type NodeState = "idle" | "pass" | "fail" | "held" | "skipped";

function stateFor(stages: Stage[], key: Stage["name"]): NodeState {
  const s = stages.find((x) => x.name === key);
  if (!s) return stages.length > 0 ? "skipped" : "idle";
  // A hold is not a failure — it is the escalation path, and colouring it red would say
  // the purchase was wrong when it was only large.
  if (key === "HOLD") return "held";
  return s.ok ? "pass" : "fail";
}

function NodeBubble({ node, state }: { node: Node; state: NodeState }) {
  const styles: Record<NodeState, string> = {
    idle: "border-edge bg-white text-ink-400",
    pass: "border-mint-500 bg-mint-50 text-mint-700 animate-pop",
    fail: "border-fail bg-red-50 text-fail animate-pop",
    held: "border-warn bg-amber-50 text-warn animate-pop",
    skipped: "border-edge bg-ink-50 text-ink-300",
  };
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-full border-2 font-mono text-[13px] font-bold transition-all duration-300 ${styles[state]}`}
      >
        {state === "pass" ? "✓" : state === "fail" ? "✕" : state === "held" ? "⏸" : node.n}
      </div>
      <div>
        <p
          className={`text-[12px] font-semibold ${
            state === "idle" || state === "skipped" ? "text-ink-400" : "text-ink-900"
          }`}
        >
          {node.label}
        </p>
        <p className="text-[10.5px] text-muted">{node.hint}</p>
      </div>
    </div>
  );
}

function Arrow({ dim = false }: { dim?: boolean }) {
  return (
    <div className={`mb-6 h-px w-6 shrink-0 sm:w-10 ${dim ? "bg-edge" : "bg-rain-300"}`} />
  );
}

/** The pulsing marker sitting on whichever leg of the race hasn't finished yet. */
function ThinkingBubble() {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-rain-300 bg-rain-50">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rain-300 opacity-60" />
        <span className="relative flex gap-0.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rain-500 [animation-delay:-0.2s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rain-500" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-rain-500 [animation-delay:0.2s]" />
        </span>
      </div>
      <p className="text-[12px] font-semibold text-rain-600">thinking…</p>
    </div>
  );
}

export function PipelineDiagram({ stages, racing = false }: { stages: Stage[]; racing?: boolean }) {
  const refused = stages.some((s) => s.name === "REFUSE");
  const held = stages.some((s) => s.name === "HOLD");
  const branch = refused ? REFUSE : held ? HOLD : ISSUE;
  // Both a refusal and a hold stop before any money moves, so everything downstream of
  // the branch is greyed rather than shown as having run.
  const stopsEarly = refused || held;
  const running = stages.length === 0 && !racing;

  // Which named node is the race currently sitting on, i.e. the last one revealed so far,
  // used only to decide where the thinking bubble goes while more are still to come.
  const order: Stage["name"][] = ["PROPOSE", "VERIFY", branch.key, "SETTLE", "REVOKE", "RECORD"];
  const revealedTo = stages.length ? order.indexOf(stages[stages.length - 1].name) : -1;
  const stillRacing = racing && revealedTo < order.length - 1;

  return (
    <div className="rounded-2xl border border-edge bg-white px-6 py-5 shadow-sm shadow-ink-900/[0.03]">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          How this works
        </p>
        {!running && !stillRacing && (
          <p className="text-[12px] font-medium text-ink-600">
            {refused
              ? "Refused before a card could exist"
              : held
                ? "Held for a person — no card exists yet"
                : "Approved, issued, settled and retired"}
          </p>
        )}
        {stillRacing && <p className="text-[12px] font-medium text-rain-600">Working through it…</p>}
      </div>

      <div className="flex flex-wrap items-start gap-x-1 gap-y-4 sm:flex-nowrap sm:overflow-x-auto">
        <NodeBubble node={PROPOSE} state={stateFor(stages, "PROPOSE")} />
        <Arrow dim={running} />
        {stillRacing && revealedTo === order.indexOf("VERIFY") - 1 ? (
          <ThinkingBubble />
        ) : (
          <NodeBubble node={VERIFY} state={stateFor(stages, "VERIFY")} />
        )}
        <Arrow dim={running} />
        {stillRacing && revealedTo === order.indexOf(branch.key) - 1 ? (
          <ThinkingBubble />
        ) : (
          <NodeBubble node={branch} state={stateFor(stages, branch.key)} />
        )}
        <Arrow dim={running || stopsEarly} />
        {stillRacing && !stopsEarly && revealedTo === order.indexOf("SETTLE") - 1 ? (
          <ThinkingBubble />
        ) : (
          <NodeBubble node={SETTLE} state={stopsEarly ? "skipped" : stateFor(stages, "SETTLE")} />
        )}
        <Arrow dim={running || stopsEarly} />
        {stillRacing && !stopsEarly && revealedTo === order.indexOf("REVOKE") - 1 ? (
          <ThinkingBubble />
        ) : (
          <NodeBubble node={REVOKE} state={stopsEarly ? "skipped" : stateFor(stages, "REVOKE")} />
        )}
        <Arrow dim={running} />
        {stillRacing && revealedTo === order.length - 2 ? (
          <ThinkingBubble />
        ) : (
          <NodeBubble node={RECORD} state={stateFor(stages, "RECORD")} />
        )}
      </div>

      <p className="mt-4 border-t border-edge pt-3 text-[12px] leading-relaxed text-muted">
        Rain bounds <b className="text-ink-700">how much</b> an agent spends and{" "}
        <b className="text-ink-700">where</b>. Mandate checks <b className="text-ink-700">why</b>{" "}
        — and if the reason does not hold, step 3 never creates a card at all.
      </p>
    </div>
  );
}
