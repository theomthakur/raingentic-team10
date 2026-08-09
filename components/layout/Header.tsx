import type { ReactNode } from "react";
import { NavBar } from "./SiteNav";
import { Badge } from "../ui";

/**
 * The front door. A judge who has never seen this before should know, in five seconds and
 * without clicking anything: what this is called, what it does, and who it was built for.
 * That's a job the old thin title bar never did — this is the fix.
 */
export function Header({
  current = "/",
  storage,
  rain,
  ruleVersion,
  errorBadge,
}: {
  current?: string;
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
      {/* Identical to every other page. The hero below is the only thing that differs. */}
      <NavBar current={current} />
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-6 py-7 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-6 md:px-10">
        <div className="flex min-w-0 items-start gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[30px] font-medium leading-tight tracking-[-0.02em] text-ink-900">
              Autonomous purchasing, bounded by proof
            </h1>
            <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted sm:text-[14.5px]">
              Finance sets the mandate once. From there, an agent negotiates, proposes,
              verifies and spends on its own. Mandate only creates a payment instrument
              when the exact purchase is supported by the record.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
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

    </header>
  );
}
