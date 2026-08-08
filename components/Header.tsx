import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "./ui";

/**
 * The front door. A judge who has never seen this before should know, in five seconds and
 * without clicking anything: what this is called, what it does, and who it was built for.
 * That's a job the old thin title bar never did — this is the fix.
 */
export function Header({
  storage,
  rainWired,
  ruleVersion,
  errorBadge,
}: {
  storage: "memory" | "postgres";
  rainWired: boolean;
  ruleVersion: number;
  errorBadge?: ReactNode;
}) {
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
            <Badge tone={rainWired ? "rain" : "neutral"}>
              {rainWired ? "rain live" : "rain simulated"}
            </Badge>
            <Badge tone="neutral">policy v{ruleVersion}</Badge>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/agents"
              className="text-[12.5px] font-medium text-muted underline-offset-4 transition hover:text-ink-900 hover:underline"
            >
              Agents →
            </Link>
            <Link
              href="/architecture"
              className="text-[12.5px] font-medium text-muted underline-offset-4 transition hover:text-ink-900 hover:underline"
            >
              System design →
            </Link>
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
