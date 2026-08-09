"use client";

import { AgentAvatar } from "@/components/identity/AgentAvatar";
import { getAgent } from "@/lib/agents";

/**
 * What the delegation actually looked like, while it is happening.
 *
 * The catalogue used to read the request, then stop and offer a "start with Rae" button.
 * That extra click was the wrong idea twice over: it made the person do the routing the
 * product claims to do for them, and it hid the only part worth watching, the work.
 *
 * So the request now runs the moment it is understood, and this shows the loop as it
 * goes. Every step is real: each one lights up when that stage has genuinely happened,
 * not on a timer. `active` is the step in progress, so the spinner sits on work that is
 * actually outstanding rather than performing progress that already finished.
 */

export type LoopStepId =
  | "understand"
  | "assign"
  | "negotiate"
  | "verify"
  | "settle";

export interface LoopState {
  /** Steps already finished, in order. */
  done: LoopStepId[];
  /** The step currently running, if any. */
  active: LoopStepId | null;
  /** Set when the run finished, so the last step can show its verdict. */
  outcome?: "approved" | "refused" | "held";
  /** Which agent picked it up, once known. */
  agentId?: string;
  /** One line of detail per finished step, e.g. who won the negotiation. */
  detail: Partial<Record<LoopStepId, string>>;
}

const STEPS: { id: LoopStepId; label: string; running: string }[] = [
  { id: "understand", label: "Understood the request", running: "Reading what you asked for" },
  { id: "assign", label: "Assigned to an agent", running: "Choosing who owns this spend" },
  { id: "negotiate", label: "Suppliers quoted", running: "Getting suppliers to compete" },
  { id: "verify", label: "Checked against the record", running: "Running the eleven checks" },
  { id: "settle", label: "Card issued and retired", running: "Issuing a card for exactly this" },
];

function Tick() {
  return (
    <svg viewBox="0 0 20 20" className="h-full w-full" aria-hidden="true">
      <path
        d="M5.5 10.5l3 3 6-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TaskLoop({ state }: { state: LoopState }) {
  const agent = state.agentId ? getAgent(state.agentId) : null;

  return (
    <ol className="space-y-0">
      {STEPS.map((step, i) => {
        const done = state.done.includes(step.id);
        const active = state.active === step.id;
        const idle = !done && !active;
        const last = i === STEPS.length - 1;

        // The final step carries the verdict, so a refusal does not show a green tick.
        const refusedHere = last && done && state.outcome && state.outcome !== "approved";
        const tone = refusedHere
          ? state.outcome === "held"
            ? { ring: "border-warn bg-amber-50 text-warn", text: "text-warn" }
            : { ring: "border-fail bg-red-50 text-fail", text: "text-fail" }
          : done
            ? { ring: "border-mint-500 bg-mint-50 text-mint-700", text: "text-ink-900" }
            : active
              ? { ring: "border-rain-400 bg-rain-50 text-rain-600", text: "text-ink-900" }
              : { ring: "border-edge bg-white text-ink-300", text: "text-ink-400" };

        return (
          <li key={step.id} className="relative flex gap-3.5 pb-5 last:pb-0">
            {!last && (
              <span
                aria-hidden="true"
                className={`absolute left-[13px] top-7 bottom-1 w-px transition-colors duration-500 ${
                  done ? "bg-mint-300" : "bg-edge"
                }`}
              />
            )}

            <span
              className={`relative mt-0.5 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${tone.ring}`}
            >
              {active && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rain-300 opacity-50" />
              )}
              {done ? (
                refusedHere ? (
                  <span className="text-[13px] font-bold leading-none">
                    {state.outcome === "held" ? "⏸" : "✕"}
                  </span>
                ) : (
                  <span className="relative h-4 w-4">
                    <Tick />
                  </span>
                )
              ) : active ? (
                <span className="relative h-1.5 w-1.5 rounded-full bg-rain-500" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-ink-200" />
              )}
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <p className={`text-[13.5px] font-medium transition-colors ${tone.text}`}>
                {active ? step.running : step.label}
                {active && <span className="ml-1 text-rain-500">…</span>}
              </p>

              {state.detail[step.id] && (
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                  {state.detail[step.id]}
                </p>
              )}

              {/* The agent shows up on its own step, the moment it is known. */}
              {step.id === "assign" && agent && (done || active) && (
                <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-edge bg-white py-1 pl-1 pr-2.5">
                  <AgentAvatar id={agent.id} size={18} />
                  <span className="text-[12px] font-medium text-ink-800">{agent.name}</span>
                  <span className="text-[11.5px] text-ink-400">{agent.role}</span>
                </span>
              )}

              {idle && !state.detail[step.id] && (
                <p className="mt-0.5 text-[12px] text-ink-300">waiting</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
