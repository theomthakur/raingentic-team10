import type { SVGProps } from "react";

/**
 * Mandate is the control layer that routes work to specialists, not one of the
 * specialists itself. Its mark deliberately uses a protected control core rather than
 * the shared operator-visor language used by the five buyers.
 */
export function MandateAvatar({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-rain-50 ${className}`}
      style={{ width: size, height: size, boxShadow: "inset 0 0 0 1.5px rgba(255,47,182,.32), 0 1px 2px rgba(255,47,182,.16)" }}
      title="Mandate — purchasing control layer"
    >
      <svg viewBox="0 0 32 32" width={size * 0.72} height={size * 0.72} fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="10.5" stroke="#ff2fb6" strokeWidth="1.8" opacity=".35" />
        <path d="M16 7.8 23.2 12v7.3c0 3.4-2.5 5.7-7.2 6.9-4.7-1.2-7.2-3.5-7.2-6.9V12L16 7.8Z" fill="#ff2fb6" />
        <path d="m12.5 16.4 2.15 2.1 4.75-4.8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24.8" cy="8" r="2.5" fill="#6e54ff" stroke="white" strokeWidth="1.2" />
      </svg>
    </span>
  );
}
