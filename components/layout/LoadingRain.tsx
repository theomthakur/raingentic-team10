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
  /** Heavier drops read as nearer. */
  w: number;
  /** A few fall off-vertical, because real rain does not fall in parallel lines. */
  slant: boolean;
}

const DROPS: Drop[] = [
  { left: 4, delay: 0.0, duration: 1.05, height: 52, opacity: 0.34, w: 1.5, slant: true },
  { left: 9, delay: 0.62, duration: 1.5, height: 26, opacity: 0.14, w: 1, slant: false },
  { left: 15, delay: 0.28, duration: 0.92, height: 64, opacity: 0.44, w: 2, slant: true },
  { left: 21, delay: 0.95, duration: 1.32, height: 34, opacity: 0.2, w: 1, slant: false },
  { left: 27, delay: 0.14, duration: 1.12, height: 46, opacity: 0.3, w: 1.5, slant: true },
  { left: 33, delay: 0.75, duration: 1.62, height: 22, opacity: 0.13, w: 1, slant: false },
  { left: 39, delay: 0.4, duration: 0.98, height: 58, opacity: 0.4, w: 2, slant: true },
  { left: 46, delay: 1.05, duration: 1.4, height: 30, opacity: 0.18, w: 1, slant: false },
  { left: 53, delay: 0.2, duration: 1.08, height: 50, opacity: 0.32, w: 1.5, slant: true },
  { left: 60, delay: 0.85, duration: 1.55, height: 24, opacity: 0.14, w: 1, slant: false },
  { left: 66, delay: 0.34, duration: 0.9, height: 66, opacity: 0.46, w: 2, slant: true },
  { left: 73, delay: 1.15, duration: 1.28, height: 36, opacity: 0.2, w: 1, slant: false },
  { left: 79, delay: 0.08, duration: 1.16, height: 44, opacity: 0.28, w: 1.5, slant: true },
  { left: 86, delay: 0.68, duration: 1.48, height: 28, opacity: 0.16, w: 1, slant: false },
  { left: 93, delay: 0.46, duration: 1.0, height: 56, opacity: 0.38, w: 2, slant: true },
  { left: 97, delay: 1.2, duration: 1.36, height: 32, opacity: 0.18, w: 1, slant: false },
];

/** Where drops land, throwing a splash. Fixed so server and client render the same. */
const SPLASHES = [
  { left: 15, delay: 0.9 },
  { left: 39, delay: 1.4 },
  { left: 66, delay: 0.6 },
  { left: 93, delay: 1.75 },
];

export function LoadingRain({ error }: { error?: string | null }) {
  return (
    <main className="relative flex h-screen items-center justify-center overflow-hidden bg-white">
      {/* the rain itself */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DROPS.map((d, i) => (
          <span
            key={i}
            className="raindrop absolute top-0 rounded-full"
            style={{
              left: `${d.left}%`,
              width: `${d.w}px`,
              height: `${d.height}px`,
              opacity: d.opacity,
              background: "linear-gradient(to bottom, transparent, #ff2fb6)",
              animation: `${d.slant ? "raindrop-fall-slanted" : "raindrop-fall"} ${d.duration}s linear ${d.delay}s infinite`,
            }}
          />
        ))}
        {SPLASHES.map((sp, i) => (
          <span
            key={`splash-${i}`}
            className="splash absolute rounded-full border border-rain-400"
            style={{
              left: `${sp.left}%`,
              bottom: "14vh",
              width: 26,
              height: 8,
              animation: `splash-out 1.5s ease-out ${sp.delay}s infinite`,
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

        <div
          className="mark-settle relative flex h-12 w-12 items-center justify-center rounded-2xl bg-rain-500 text-xl font-bold text-white shadow-lg shadow-rain-500/30"
          style={{ animation: "mark-settle 620ms cubic-bezier(.2,.8,.2,1) both" }}
        >
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
            {/* Word and subtitle arrive after the mark has landed, so the sequence reads
                as one motion instead of three things appearing at once. */}
            <p
              className="word-in mt-5 font-display text-[22px] font-medium tracking-[-0.01em] text-ink-900"
              style={{ animation: "word-in 420ms ease-out 300ms both" }}
            >
              Raining<span className="text-rain-500">…</span>
            </p>
            <p
              className="word-in mt-1 text-[12.5px] text-muted"
              style={{ animation: "word-in 420ms ease-out 440ms both" }}
            >
              Reading the decision log
            </p>
          </>
        )}
      </div>
    </main>
  );
}
