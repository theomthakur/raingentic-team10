import type { GlyphKey } from "@/lib/catalog";

/**
 * Product renders, drawn rather than photographed.
 *
 * Same reasoning as the vendor avatars: these are generic depictions of a category, not
 * any manufacturer's product photography, which we have no licence to ship. Drawing them
 * also means they stay crisp at any size and add nothing to the page weight.
 *
 * Each drawing gets its own gradient ids, namespaced by key, because several render on
 * the same page and duplicate ids would cross-wire the fills.
 */

interface Art {
  bg: [string, string];
  render: (id: (n: string) => string) => React.ReactNode;
}

const ART: Record<GlyphKey, Art> = {
  // A carton with reams stacked inside, lid open.
  paper: {
    bg: ["#eafaf0", "#d3f4de"],
    render: (id) => (
      <>
        <defs>
          <linearGradient id={id("box")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d8a066" />
            <stop offset="100%" stopColor="#b87c42" />
          </linearGradient>
        </defs>
        {/* reams */}
        <rect x="28" y="30" width="18" height="26" rx="1.5" fill="#ffffff" stroke="#cfd6dd" strokeWidth="1.2" />
        <rect x="48" y="26" width="18" height="30" rx="1.5" fill="#ffffff" stroke="#cfd6dd" strokeWidth="1.2" />
        <path d="M31 36h12M31 41h12M51 32h12M51 37h12" stroke="#c3ccd6" strokeWidth="1.6" strokeLinecap="round" />
        {/* carton */}
        <path d="M22 52h50v20a3 3 0 0 1-3 3H25a3 3 0 0 1-3-3z" fill={`url(#${id("box")})`} />
        <path d="M22 52h50l-6-7H28z" fill="#e6b380" />
        <path d="M40 52v23M54 52v23" stroke="#a06c36" strokeWidth="1" opacity=".5" />
      </>
    ),
  },

  // A dual-fan accelerator card, seen face on.
  gpu: {
    bg: ["#fdeaf7", "#fbd6ee"],
    render: (id) => (
      <>
        <defs>
          <linearGradient id={id("shroud")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d4350" />
            <stop offset="100%" stopColor="#22262f" />
          </linearGradient>
        </defs>
        <rect x="14" y="30" width="68" height="34" rx="4" fill={`url(#${id("shroud")})`} />
        <rect x="14" y="30" width="68" height="5" rx="2.5" fill="#4d5462" />
        {[32, 62].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="47" r="11" fill="#171a20" />
            <circle cx={cx} cy="47" r="9" fill="none" stroke="#565e6d" strokeWidth="1.2" />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <path
                key={a}
                d={`M${cx} 47 L${cx + 8 * Math.cos((a * Math.PI) / 180)} ${47 + 8 * Math.sin((a * Math.PI) / 180)}`}
                stroke="#6c7484"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            ))}
            <circle cx={cx} cy="47" r="2.6" fill="#8b93a3" />
          </g>
        ))}
        {/* PCIe fingers */}
        <path d="M24 64h34v5H24z" fill="#d8b45a" />
        <path d="M30 64v5M36 64v5M42 64v5M48 64v5" stroke="#a8873c" strokeWidth="1" />
        <rect x="72" y="36" width="4" height="10" rx="1" fill="#ff2fb6" opacity=".85" />
      </>
    ),
  },

  // Task chair, three-quarter view.
  chair: {
    bg: ["#f1ecfe", "#e2d9fd"],
    render: (id) => (
      <>
        <defs>
          <linearGradient id={id("mesh")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6b5bd6" />
            <stop offset="100%" stopColor="#4b3ba8" />
          </linearGradient>
        </defs>
        <path d="M34 18h26a5 5 0 0 1 5 5v20a5 5 0 0 1-5 5H34a5 5 0 0 1-5-5V23a5 5 0 0 1 5-5z" fill={`url(#${id("mesh")})`} />
        <path d="M35 25h24M35 31h24M35 37h24" stroke="#8d80e4" strokeWidth="1.2" opacity=".8" />
        <rect x="28" y="50" width="38" height="8" rx="4" fill="#3f3590" />
        <path d="M47 58v12" stroke="#6b7280" strokeWidth="4" strokeLinecap="round" />
        <path d="M32 78l15-8 15 8" stroke="#6b7280" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <circle cx="31" cy="79" r="3" fill="#4b5160" />
        <circle cx="63" cy="79" r="3" fill="#4b5160" />
      </>
    ),
  },

  // Cylindrical inductive proximity sensor with a lead.
  sensor: {
    bg: ["#e6f7fb", "#cceef6"],
    render: (id) => (
      <>
        <defs>
          <linearGradient id={id("steel")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d3dae2" />
            <stop offset="45%" stopColor="#9aa5b1" />
            <stop offset="100%" stopColor="#6f7885" />
          </linearGradient>
        </defs>
        <rect x="26" y="38" width="40" height="20" rx="3" fill={`url(#${id("steel")})`} />
        <path d="M34 38v20M40 38v20M46 38v20" stroke="#7d8794" strokeWidth="1" opacity=".7" />
        <rect x="64" y="36" width="10" height="24" rx="3" fill="#c9713a" />
        <circle cx="69" cy="42" r="2" fill="#ffd9a8" />
        <path d="M26 48H14" stroke="#3a4049" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="72" cy="48" r="7" fill="none" stroke="#0891b2" strokeWidth="1.6" opacity=".55" />
        <circle cx="72" cy="48" r="11" fill="none" stroke="#0891b2" strokeWidth="1.4" opacity=".3" />
      </>
    ),
  },

  // Steel L-bracket, isometric, with bolt holes.
  bracket: {
    bg: ["#eef1f4", "#dfe4e9"],
    render: (id) => (
      <>
        <defs>
          <linearGradient id={id("plate")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#aeb7c2" />
            <stop offset="100%" stopColor="#79828f" />
          </linearGradient>
        </defs>
        <path d="M26 20h13v42h32v13H26z" fill={`url(#${id("plate")})`} />
        <path d="M26 20h13l-4 5h-9zM71 62v13l4-4V62z" fill="#606a77" opacity=".8" />
        <circle cx="32.5" cy="30" r="3" fill="#4c5561" />
        <circle cx="32.5" cy="44" r="3" fill="#4c5561" />
        <circle cx="50" cy="68.5" r="3" fill="#4c5561" />
        <circle cx="63" cy="68.5" r="3" fill="#4c5561" />
      </>
    ),
  },

  // Stacked metal billets.
  alloy: {
    bg: ["#fdf0e2", "#fbe0c6"],
    render: (id) => (
      <>
        <defs>
          <linearGradient id={id("bar")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c8d0d9" />
            <stop offset="100%" stopColor="#8d97a3" />
          </linearGradient>
        </defs>
        {[
          [22, 52],
          [46, 52],
          [34, 36],
        ].map(([x, y], i) => (
          <g key={i}>
            <path d={`M${x} ${y + 8} l10-6 22 0 -10 6z`} fill="#dfe5ec" />
            <rect x={x} y={y + 8} width="22" height="14" rx="1.5" fill={`url(#${id("bar")})`} />
            <path d={`M${x + 22} ${y + 8} l10-6 0 14 -10 6z`} fill="#6f7883" />
          </g>
        ))}
      </>
    ),
  },

  // Box truck for a freight lane booking.
  freight: {
    bg: ["#fdeee6", "#fbdccc"],
    render: (id) => (
      <>
        <defs>
          <linearGradient id={id("body")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f4f6f8" />
            <stop offset="100%" stopColor="#d5dae0" />
          </linearGradient>
        </defs>
        <rect x="14" y="30" width="40" height="32" rx="3" fill={`url(#${id("body")})`} stroke="#c0c7cf" strokeWidth="1.2" />
        <path d="M22 38h24M22 46h24" stroke="#c8ced5" strokeWidth="1.6" />
        <path d="M54 40h13l9 11v11H54z" fill="#c2410c" />
        <path d="M57 43h8l6 7h-14z" fill="#ffd7bd" />
        <circle cx="28" cy="66" r="6.5" fill="#2f343b" />
        <circle cx="28" cy="66" r="2.6" fill="#8b939d" />
        <circle cx="65" cy="66" r="6.5" fill="#2f343b" />
        <circle cx="65" cy="66" r="2.6" fill="#8b939d" />
      </>
    ),
  },

  // Roller conveyor carrying a crate.
  conveyor: {
    bg: ["#e8f2fb", "#d2e6f8"],
    render: (id) => (
      <>
        <defs>
          <linearGradient id={id("crate")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e0aa6d" />
            <stop offset="100%" stopColor="#bd8442" />
          </linearGradient>
        </defs>
        <rect x="34" y="24" width="30" height="22" rx="2" fill={`url(#${id("crate")})`} />
        <path d="M34 32h30M49 24v22" stroke="#9c6a33" strokeWidth="1.6" opacity=".65" />
        <rect x="14" y="50" width="70" height="6" rx="3" fill="#8b95a1" />
        {[22, 36, 50, 64, 78].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="64" r="7" fill="#59616c" />
            <circle cx={cx} cy="64" r="3" fill="#98a2ae" />
          </g>
        ))}
        <path d="M14 73h70" stroke="#7a848f" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
  },
};

export function ProductGlyph({ glyph, size = 76 }: { glyph: GlyphKey; size?: number }) {
  const art = ART[glyph];
  const id = (n: string) => `${glyph}-${n}`;
  return (
    <span className="inline-block shrink-0 overflow-hidden rounded-xl" style={{ width: size, height: size }}>
      <svg viewBox="0 0 96 96" width="100%" height="100%" role="img" aria-hidden="true">
        <defs>
          <linearGradient id={id("bg")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={art.bg[0]} />
            <stop offset="100%" stopColor={art.bg[1]} />
          </linearGradient>
        </defs>
        <rect width="96" height="96" rx="14" fill={`url(#${id("bg")})`} />
        {art.render(id)}
      </svg>
    </span>
  );
}
