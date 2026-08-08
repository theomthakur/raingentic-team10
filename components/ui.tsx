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
    <section className={`rounded-lg border border-edge bg-panel ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-edge px-4 py-2.5">
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
  tone?: "pass" | "fail" | "neutral" | "warn";
  children: ReactNode;
}) {
  const tones = {
    pass: "border-pass/40 bg-pass/10 text-pass",
    fail: "border-fail/40 bg-fail/10 text-fail",
    warn: "border-warn/40 bg-warn/10 text-warn",
    neutral: "border-edge bg-edge/40 text-muted",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[11px] leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** The dot that tells you pass / fail / didn't run at a glance. */
export function Dot({ state }: { state: "pass" | "fail" | "skip" }) {
  const cls =
    state === "pass" ? "bg-pass" : state === "fail" ? "bg-fail" : "bg-slate-600";
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
    primary:
      "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
    default: "border-edge bg-edge/40 text-slate-200 hover:bg-edge",
    ghost: "border-transparent text-muted hover:text-slate-200 hover:bg-edge/40",
  } as const;
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded border px-3 py-1.5 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-[13px] text-muted">{children}</p>;
}
