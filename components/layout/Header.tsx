import type { ReactNode } from "react";
import { NavBar } from "./SiteNav";
import { Badge } from "../ui";

/**
 * The front door. A judge who has never seen this before should know, in five seconds and
 * without clicking anything: what this is called, what it does, and who it was built for.
 * That's a job the old thin title bar never did — this is the fix.
 */
export function Header({
  errorBadge,
}: {
  storage: "memory" | "postgres";
  rain: { mode: "off" | "simulated" | "live"; reason?: string };
  ruleVersion: number;
  errorBadge?: ReactNode;
}) {
  return (
    <header className="border-b border-edge bg-white/80 backdrop-blur-sm">
      {/* Identical to every other page. The hero below is the only thing that differs. */}
      <NavBar current="/" />
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-6 py-7 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-6 md:px-10">
        <div className="flex min-w-0 items-start gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[30px] font-medium leading-tight tracking-[-0.02em] text-ink-900">
              Your purchasing agent
            </h1>
            <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted sm:text-[14.5px]">
              Tell Mandate what needs doing. It finds the supplier, takes care of the
              purchase, and keeps the spend inside the rules you set.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          {errorBadge && <div>{errorBadge}</div>}

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 rounded-full border border-edge bg-ink-50 py-1.5 pl-3 pr-3.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
                Built with
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
