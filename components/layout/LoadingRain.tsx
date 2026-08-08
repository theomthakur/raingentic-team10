import Link from "next/link";
import { SiteNav } from "./SiteNav";

/**
 * The loading screen.
 *
 * It used to say "Loading…" in grey. It is on screen for well under a second, which is
 * precisely why it is worth doing: it is the first frame anyone sees, including the three
 * judges whose company it is named after. Drops are positioned and timed from a fixed
 * table rather than Math.random(), so the server and client render identical markup —
 * random values here would produce a hydration mismatch on every load.
 */

interface Drop {
  left: number;
  delay: number;
  duration: number;
  height: number;
  opacity: number;
}

const DROPS: Drop[] = [
  { left: 6, delay: 0.0, duration: 1.15, height: 46, opacity: 0.28 },
  { left: 13, delay: 0.55, duration: 1.45, height: 30, opacity: 0.18 },
  { left: 21, delay: 0.22, duration: 1.0, height: 58, opacity: 0.4 },
  { left: 28, delay: 0.85, duration: 1.3, height: 36, opacity: 0.22 },
  { left: 35, delay: 0.4, duration: 1.6, height: 26, opacity: 0.16 },
  { left: 43, delay: 0.12, duration: 1.1, height: 52, opacity: 0.34 },
  { left: 50, delay: 0.72, duration: 1.35, height: 40, opacity: 0.24 },
  { left: 57, delay: 0.3, duration: 0.95, height: 62, opacity: 0.42 },
  { left: 65, delay: 0.95, duration: 1.5, height: 28, opacity: 0.18 },
  { left: 72, delay: 0.05, duration: 1.2, height: 48, opacity: 0.3 },
  { left: 79, delay: 0.62, duration: 1.4, height: 34, opacity: 0.2 },
  { left: 87, delay: 0.35, duration: 1.05, height: 56, opacity: 0.36 },
  { left: 94, delay: 0.8, duration: 1.55, height: 32, opacity: 0.2 },
];

export function LoadingRain({ error }: { error?: string | null }) {
  return (
    <main className="relative flex h-screen items-center justify-center overflow-hidden bg-white">
      {/* the rain itself */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DROPS.map((d, i) => (
          <span
            key={i}
            className="raindrop absolute top-0 w-px rounded-full"
            style={{
              left: `${d.left}%`,
              height: `${d.height}px`,
              opacity: d.opacity,
              background: "linear-gradient(to bottom, transparent, #ff2fb6)",
              animation: `raindrop-fall ${d.duration}s linear ${d.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center">
        {/* ripples spreading from under the mark */}
        <span aria-hidden="true" className="absolute top-6 h-12 w-12">
          {[0, 1.1].map((delay) => (
            <span
              key={delay}
              className="ripple absolute inset-0 rounded-full border border-rain-300"
              style={{ animation: `ripple-out 2.2s ease-out ${delay}s infinite` }}
            />
          ))}
        </span>

        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-rain-500 text-xl font-bold text-white shadow-sm shadow-rain-500/25">
          M
        </div>

        {error ? (
          // A failed load used to be a total dead end: the message, and no way anywhere.
          // Every other page is static and would have loaded fine, so stranding someone
          // here is the one avoidable failure in the whole app.
          <div className="mt-5 flex max-w-sm flex-col items-center gap-3">
            <p className="text-center text-[13px] text-fail">{error}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-rain-500 px-3.5 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-rain-600"
              >
                Try again
              </button>
              <Link
                href="/architecture"
                className="rounded-full border border-edge px-3.5 py-1.5 text-[12.5px] font-medium text-ink-700 transition hover:bg-ink-50"
              >
                System design
              </Link>
            </div>
            <SiteNav current="" />
          </div>
        ) : (
          <>
            <p className="mt-5 font-display text-[22px] font-medium tracking-[-0.01em] text-ink-900">
              Raining<span className="text-rain-500">…</span>
            </p>
            <p className="mt-1 text-[12.5px] text-muted">Reading the decision log</p>
          </>
        )}
      </div>
    </main>
  );
}
