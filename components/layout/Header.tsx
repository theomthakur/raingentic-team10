import type { ReactNode } from "react";
import { SiteNav } from "./SiteNav";
import { Badge } from "../ui";

/**
 * The front door. A judge who has never seen this before should know, in five seconds and
 * without clicking anything: what this is called, what it does, and who it was built for.
 * That's a job the old thin title bar never did — this is the fix.
 */
export function Header({
  storage,
  rain,
  ruleVersion,
  errorBadge,
}: {
  storage: "memory" | "postgres";
  rain: { mode: "off" | "simulated" | "live"; reason?: string };
  ruleVersion: number;
  errorBadge?: ReactNode;
}) {
  // Deliberately not driven by whether a key exists. A failed Rain call must never look
  // like a successful one from across a room.
  const rainBadge = {
    live: { tone: "rain" as const, label: "rain live" },
    simulated: { tone: "warn" as const, label: "cards simulated" },
    off: { tone: "neutral" as const, label: "rain not connected" },
  }[rain.mode];
  return (
    <header className="border-b border-edge bg-white">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-start justify-between gap-6 px-6 py-7 md:px-10">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rain-500 text-xl font-bold text-white shadow-sm shadow-rain-500/20">
            M
          </div>
          <div>
            <h1 className="font-display text-[30px] font-medium leading-tight tracking-[-0.02em] text-ink-900">
              Mandate
            </h1>
            <p className="mt-1.5 max-w-xl text-[14.5px] leading-relaxed text-muted">
              An agent wants to spend money. Rain can issue the card — Mandate checks the
              reason first, so a card only ever exists when the reason holds up.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {errorBadge}
            <Badge tone={storage === "postgres" ? "pass" : "warn"}>
              {storage === "postgres" ? "postgres" : "in-memory"}
            </Badge>
            <span title={rain.reason ?? "A real Rain card was issued this session."}>
              <Badge tone={rainBadge.tone}>{rainBadge.label}</Badge>
            </span>
            <Badge tone="neutral">policy v{ruleVersion}</Badge>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 rounded-full border border-edge bg-ink-50 py-1.5 pl-3 pr-3.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
                Built for
              </span>
              <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-rain-600">
                <span className="h-2 w-2 rounded-full bg-rain-500" />
                Rain
              </span>
              <span className="text-ink-300">×</span>
              <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-monad-700">
                <span className="h-2 w-2 rounded-full bg-monad-500" />
                Monad
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* The console is where a judge lands, and it used to be the one page with no way
          out — SiteNav was imported here and never rendered, so every other page was
          unreachable from the front door. */}
      <div className="mx-auto max-w-[1600px] px-6 pb-3 md:px-10">
        <SiteNav current="/" />
      </div>
    </header>
  );
}
