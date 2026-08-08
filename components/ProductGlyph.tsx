import type { GlyphKey } from "@/lib/catalog";

/**
 * Simple drawn product illustrations. Same reasoning as the vendor avatars: these are
 * generic depictions of a category, not any manufacturer's actual product photography.
 */

const STROKE = 1.6;

function Frame({ tint, children }: { tint: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill={`${tint}12`} />
      <g stroke={tint} strokeWidth={STROKE} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

const DRAWINGS: Record<GlyphKey, { tint: string; art: React.ReactNode }> = {
  paper: {
    tint: "#0f9d58",
    art: (
      <>
        <rect x="14" y="12" width="20" height="24" rx="2" />
        <path d="M18 19h12M18 24h12M18 29h8" />
      </>
    ),
  },
  gpu: {
    tint: "#b30f7c",
    art: (
      <>
        <rect x="11" y="17" width="26" height="15" rx="2" />
        <rect x="16" y="22" width="7" height="5" rx="1" />
        <path d="M27 22v5M31 22v5M15 32v4M33 32v4" />
      </>
    ),
  },
  chair: {
    tint: "#7c3aed",
    art: (
      <>
        <path d="M17 12h14v11H17z" />
        <path d="M15 23h18M24 23v8M18 39l6-8 6 8" />
      </>
    ),
  },
  sensor: {
    tint: "#0891b2",
    art: (
      <>
        <circle cx="24" cy="24" r="6" />
        <circle cx="24" cy="24" r="2" />
        <path d="M24 12v3M24 33v3M12 24h3M33 24h3" />
      </>
    ),
  },
  bracket: {
    tint: "#4b5160",
    art: (
      <>
        <path d="M15 13v22h18" />
        <circle cx="20" cy="18" r="1.6" />
        <circle cx="28" cy="30" r="1.6" />
      </>
    ),
  },
  alloy: {
    tint: "#b45309",
    art: (
      <>
        <path d="M12 20l12-6 12 6-12 6z" />
        <path d="M12 20v8l12 6 12-6v-8" />
      </>
    ),
  },
  freight: {
    tint: "#c2410c",
    art: (
      <>
        <path d="M10 18h17v13H10zM27 22h7l4 5v4h-11z" />
        <circle cx="16" cy="34" r="3" />
        <circle cx="32" cy="34" r="3" />
      </>
    ),
  },
  conveyor: {
    tint: "#0369a1",
    art: (
      <>
        <path d="M11 30h26" />
        <circle cx="15" cy="34" r="3.5" />
        <circle cx="24" cy="34" r="3.5" />
        <circle cx="33" cy="34" r="3.5" />
        <rect x="19" y="16" width="11" height="9" rx="1.5" />
      </>
    ),
  },
};

export function ProductGlyph({ glyph, size = 56 }: { glyph: GlyphKey; size?: number }) {
  const d = DRAWINGS[glyph];
  return (
    <span className="inline-block shrink-0" style={{ width: size, height: size }}>
      <Frame tint={d.tint}>{d.art}</Frame>
    </span>
  );
}
