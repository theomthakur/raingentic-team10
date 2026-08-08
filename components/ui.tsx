import type { ReactNode } from "react";

export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-edge bg-panel shadow-sm shadow-ink-900/[0.03] ${className}`}
    >
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-edge px-4 py-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "pass" | "fail" | "neutral" | "warn" | "rain" | "monad";
  children: ReactNode;
}) {
  const tones = {
    pass: "border-mint-500/30 bg-mint-50 text-mint-700",
    fail: "border-fail/25 bg-red-50 text-fail",
    warn: "border-warn/30 bg-amber-50 text-warn",
    neutral: "border-edge bg-ink-50 text-muted",
    rain: "border-rain-500/25 bg-rain-50 text-rain-600",
    monad: "border-monad-500/25 bg-monad-50 text-monad-700",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** The dot that tells you pass / fail / didn't run at a glance. */
export function Dot({ state }: { state: "pass" | "fail" | "skip" }) {
  const cls =
    state === "pass" ? "bg-mint-500" : state === "fail" ? "bg-fail" : "bg-ink-300";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

export function Button({
  onClick,
  children,
  variant = "default",
  disabled,
  title,
}: {
  onClick?: () => void;
  children: ReactNode;
  variant?: "default" | "primary" | "ghost";
  disabled?: boolean;
  title?: string;
}) {
  const variants = {
    primary: "border-transparent bg-rain-500 text-white hover:bg-rain-600 active:scale-[0.98]",
    default: "border-edge bg-white text-ink-800 hover:border-ink-300 hover:bg-ink-50",
    ghost: "border-transparent text-muted hover:text-ink-900 hover:bg-ink-50",
  } as const;
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-[13px] text-muted">{children}</p>;
}
