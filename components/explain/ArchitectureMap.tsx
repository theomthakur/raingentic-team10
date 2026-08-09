import { Badge } from "../ui";

type Tone = "neutral" | "rain" | "monad" | "pass" | "violet";

const TONE: Record<Tone, { shell: string; number: string; badge?: "rain" | "monad" | "pass" }> = {
  neutral: { shell: "border-edge bg-white", number: "bg-ink-100 text-ink-700" },
  rain: { shell: "border-rain-200 bg-rain-50/60", number: "bg-rain-500 text-white", badge: "rain" },
  monad: { shell: "border-monad-200 bg-monad-50/60", number: "bg-monad-500 text-white", badge: "monad" },
  pass: { shell: "border-mint-500/30 bg-mint-50/60", number: "bg-mint-600 text-white", badge: "pass" },
  violet: { shell: "border-violet-200 bg-violet-50/60", number: "bg-violet-500 text-white" },
};

function Node({
  number,
  title,
  description,
  api,
  tone = "neutral",
  badge,
}: {
  number: string;
  title: string;
  description: string;
  api?: string;
  tone?: Tone;
  badge?: string;
}) {
  const style = TONE[tone];
  return (
    <div className={`rounded-xl border p-4 shadow-sm shadow-ink-900/[0.025] ${style.shell}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold ${style.number}`}>
          {number}
        </span>
        {badge ? (
          style.badge ? <Badge tone={style.badge}>{badge}</Badge> : <span className="font-mono text-[10px] text-violet-700">{badge}</span>
        ) : null}
      </div>
      <h3 className="mt-3 text-[14px] font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-600">{description}</p>
      {api ? <p className="mt-3 break-all rounded-md bg-white/70 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-ink-600">{api}</p> : null}
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="relative flex min-h-10 items-center justify-center py-1 lg:min-h-0 lg:w-12 lg:py-0">
      <span className="hidden h-px w-full bg-ink-200 lg:block" />
      <span className="hidden absolute right-0 h-0 w-0 border-y-[5px] border-l-[7px] border-y-transparent border-l-ink-300 lg:block" />
      <span className="rounded-full border border-edge bg-white px-2 py-0.5 font-mono text-[9px] text-muted lg:absolute lg:-top-4 lg:whitespace-nowrap">{label}</span>
      <span className="mt-0.5 text-ink-300 lg:hidden">↓</span>
    </div>
  );
}

/** A judge-facing system map. It names the boundary, the live external calls, and the evidence path. */
export function ArchitectureMap() {
  return (
    <section className="overflow-hidden rounded-2xl border border-edge bg-ink-50/40 shadow-sm shadow-ink-900/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge bg-white px-5 py-4 sm:px-6">
        <div>
          <p className="text-[13px] font-semibold text-ink-900">System architecture</p>
          <p className="mt-0.5 text-[12px] text-muted">Mandate sits between an autonomous agent and programmable money.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="rain">Rain sandbox API</Badge>
          <Badge tone="monad">Monad testnet RPC</Badge>
          <Badge tone="pass">Postgres evidence</Badge>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className="grid items-stretch lg:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1.22fr)_3rem_minmax(0,1fr)]">
          <Node
            number="01"
            title="Customer goal"
            description="A person gives one outcome, then steps away: restock paper, source GPU capacity, or book freight."
            api="UI → POST /api/intake"
            badge="input"
          />
          <Arrow label="goal" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Node
              number="02"
              title="Agent & sourcing"
              description="Groq interprets the goal. A specialist compares modeled supplier offers and proposes one exact PO."
              api="Groq API → chat completions"
              tone="violet"
              badge="model-assisted"
            />
            <Node
              number="03"
              title="Mandate control plane"
              description="Eleven deterministic checks verify vendor, amount, budget, authority, expiry, and duplicate risk. No model can override them."
              api="POST /api/purchase → policy evaluator"
              tone="pass"
              badge="Mandate"
            />
          </div>
          <Arrow label="approved PO only" />
          <Node
            number="04"
            title="Scoped payment"
            description="Only an approved PO reaches Rain. A card is capped to that order, then sandbox-authorized and settled."
            api="Rain API → /cards/scoped → /authorize → /settle"
            tone="rain"
            badge="Rain"
          />
        </div>

        <div className="my-5 border-t border-dashed border-edge" />

        <div className="grid gap-3 md:grid-cols-[minmax(0,1.22fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-edge bg-white p-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-400">Policy outcomes</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <p className="rounded-lg bg-mint-50 px-2.5 py-2 text-[11px] leading-relaxed text-mint-700"><strong>Approved</strong><br />Issue scoped card</p>
              <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-warn"><strong>Above authority</strong><br />Hold for person</p>
              <p className="rounded-lg bg-red-50 px-2.5 py-2 text-[11px] leading-relaxed text-fail"><strong>Policy fails</strong><br />Stop before card</p>
            </div>
          </div>
          <Node
            number="05"
            title="Tamper-evident policy"
            description="Rain issuance is blocked until Monad confirms the active policy's exact hash. New versions anchor on first autonomous use."
            api="Monad RPC → eth_sendRawTransaction → receipt verified"
            tone="monad"
            badge="Monad"
          />
          <Node
            number="06"
            title="Replayable evidence"
            description="Every PO, check result, outcome, receipt, and Rain response is saved for replay."
            api="Neon Postgres → append-only decision log"
            tone="pass"
            badge="Postgres"
          />
        </div>

        <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
          External boundary: suppliers are modeled profiles. Rain runs in its sandbox and Monad runs on testnet, so no real customer funds or personal data are used.
        </p>
      </div>
    </section>
  );
}
