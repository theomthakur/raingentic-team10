"use client";

import type { Stage } from "@/lib/pipeline";

/**
 * The pipeline as rainfall.
 *
 * The horizontal diagram stays — it is the one that reads like an architecture drawing and
 * it is what a judge points at. This is the other view: the same stages, falling, so the
 * run has a direction and a bottom. A purchase that is refused visibly stops partway down
 * instead of quietly greying out a box to the right, which is a much clearer way to show
 * that nothing downstream ever ran.
 *
 * It shares the Stage data with everything else, so there is nothing to keep in sync.
 */

const LABELS: Record<Stage["name"], { title: string; hint: string }> = {
  NEGOTIATE: { title: "Negotiate", hint: "sellers compete for the order" },
  PROPOSE: { title: "Propose", hint: "the agent declares what it wants" },
  VERIFY: { title: "Verify", hint: "eleven checks against the record" },
  HOLD: { title: "Hold", hint: "waiting for a person" },
  APPROVE: { title: "Approve", hint: "a named person released it" },
  REFUSE: { title: "Refuse", hint: "no card is ever created" },
  ISSUE: { title: "Issue", hint: "Rain issues a scoped card" },
  SETTLE: { title: "Settle", hint: "the purchase happens" },
  REVOKE: { title: "Revoke", hint: "the card is retired" },
  RECORD: { title: "Record", hint: "written down, append-only" },
};

function toneFor(s: Stage): { dot: string; ring: string; text: string; drop: string } {
  if (s.name === "REFUSE") {
    return { dot: "bg-fail", ring: "ring-fail/25", text: "text-fail", drop: "bg-fail/30" };
  }
  if (s.name === "HOLD") {
    return { dot: "bg-warn", ring: "ring-warn/25", text: "text-warn", drop: "bg-warn/30" };
  }
  if (!s.ok) {
    return { dot: "bg-fail", ring: "ring-fail/25", text: "text-fail", drop: "bg-fail/30" };
  }
  return { dot: "bg-rain-500", ring: "ring-rain-500/20", text: "text-ink-900", drop: "bg-rain-300" };
}

export function RainFlow({ stages }: { stages: Stage[] }) {
  if (stages.length === 0) return null;

  const last = stages[stages.length - 1];
  const stoppedEarly = stages.some((s) => s.name === "REFUSE" || s.name === "HOLD");

  return (
    <div className="rounded-2xl border border-edge bg-white px-6 py-5 shadow-sm shadow-ink-900/[0.03]">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          The run, falling
        </p>
        <p className={`text-[12px] font-medium ${toneFor(last).text}`}>
          {stages.some((s) => s.name === "REFUSE")
            ? "Stopped before a card could exist"
            : stages.some((s) => s.name === "HOLD")
              ? "Paused for a person"
              : "Landed"}
        </p>
      </div>

      <ol className="relative">
        {stages.map((s, i) => {
          const tone = toneFor(s);
          const meta = LABELS[s.name] ?? { title: s.name, hint: "" };
          const isLast = i === stages.length - 1;

          return (
            <li
              key={`${s.name}-${i}`}
              className="relative flex animate-row-in gap-4 pb-5 last:pb-0"
              style={{ animationDelay: `${i * 110}ms`, animationFillMode: "backwards" }}
            >
              {/* the falling trail between one stage and the next */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`absolute left-[11px] top-6 h-full w-px ${tone.drop}`}
                />
              )}

              <span
                className={`relative mt-1 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full ring-4 ${tone.ring}`}
              >
                <span className={`h-[9px] w-[9px] rounded-full ${tone.dot}`} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2.5">
                  <p className={`text-[13.5px] font-semibold ${tone.text}`}>{meta.title}</p>
                  <p className="text-[11.5px] text-ink-400">{meta.hint}</p>
                </div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-600">{s.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {stoppedEarly && (
        <p className="mt-4 border-t border-edge pt-3 text-[12px] leading-relaxed text-muted">
          Everything below this point never ran. That is the difference between a refusal
          and a decline — there is no card sitting somewhere waiting to be cancelled.
        </p>
      )}
    </div>
  );
}
