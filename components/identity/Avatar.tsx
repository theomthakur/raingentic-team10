/**
 * Small colored initials, standing in for a logo we have no right to use.
 *
 * The sellers a task can negotiate with (Office Depot, Staples, Akash Network...) are real
 * companies. Pulling their actual logos into a demo that shows them losing a fabricated
 * price negotiation is the kind of thing that reads fine right up until it doesn't, so
 * every vendor and every agent gets the same generated mark instead: deterministic color,
 * first letters, no real brand asset anywhere.
 */

const PALETTE = [
  "#ff2fb6", "#6e54ff", "#0891b2", "#7c3aed", "#c2410c",
  "#0f9d58", "#b30f7c", "#4b5160", "#b45309", "#0369a1",
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function Avatar({
  name,
  color,
  size = 28,
  className = "",
}: {
  name: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  const bg = color ?? colorFor(name);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{ width: size, height: size, background: bg, fontSize: size * 0.38 }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
