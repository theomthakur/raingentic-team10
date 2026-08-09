"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Badge, Button, Panel } from "../ui";
import { FlowDiagram } from "./FlowDiagram";
import { GithubIcon, LinkedinIcon } from "../icons";

/**
 * The deck. Fourteen slides, keyboard-driven, in the same type and palette as the console.
 *
 * A hackathon is judged in five minutes standing up, and the thing that loses those five
 * minutes is switching windows — a PDF in one app, the running product in another, the
 * repo in a third. So the deck lives at a route inside the product it is describing: the
 * judge is already looking at the real thing, and every claim on a slide is one click from
 * the screen that backs it.
 *
 * Every number here is read off the build, not rounded up for the stage: 84 tests, eleven
 * rules, $25,000 delegated limit, $43,500 capital purchase. If a claim is only partly true,
 * the slide says which part.
 */

interface Slide {
  id: string;
  /** Short name, used by the jump dots and the screen-reader announcement. */
  label: string;
  eyebrow: string;
  body: ReactNode;
}

/* ---------------------------------------------------------------- slide fragments */

const CHECKS: { id: string; label: string; basis: string; star?: boolean }[] = [
  {
    id: "po-exists",
    label: "The purchase order exists, and was accepted",
    basis: "Three-way match, PO leg",
  },
  {
    id: "po-open",
    label: "Still open, and the quote has not expired",
    basis: "Three-way match, receipt leg",
  },
  {
    id: "amount-matches",
    label: "The amount matches the accepted quote",
    basis: "Invoice price-variance tolerance",
  },
  {
    id: "line-matches",
    label: "The vendor and the SKU match the accepted quote",
    basis: "Line-level match — no card network can express this",
    star: true,
  },
  {
    id: "within-budget",
    label: "Within the cost centre's remaining budget",
    basis: "Commitment accounting",
  },
  {
    id: "no-existing-card",
    label: "No card has already been issued for this PO",
    basis: "Idempotency key",
    star: true,
  },
  {
    id: "requires-approval",
    label: "Above $25,000, a named person must release it",
    basis: "Delegation of authority",
  },
  {
    id: "no-structuring",
    label: "Not a large purchase split in two to duck approval",
    basis: "Structuring detection",
  },
  {
    id: "agent-authority",
    label: "Inside this particular agent's own limit",
    basis: "Role-based delegation",
  },
  {
    id: "known-vendor",
    label: "A supplier we have paid before",
    basis: "New-payee verification",
  },
  {
    id: "velocity",
    label: "Not spending faster than this agent should",
    basis: "Velocity limiting",
  },
];

const DEMO: { n: string; what: string; detail: string; key?: boolean }[] = [
  {
    n: "1",
    what: "Run a purchasing task.",
    detail:
      "Four suppliers bid, the buyer counters once, one wins. A card is created for exactly that total, expiring with the quote.",
  },
  {
    n: "2",
    what: "Press the same button again.",
    detail:
      "No second scenario, no bad agent written to fail. Refused — by the record the first run itself wrote. Rain is never contacted.",
    key: true,
  },
  {
    n: "3",
    what: "Click the refusal.",
    detail:
      "Four fields: which rule failed, what it expected, what it got, and exactly which record it read.",
  },
  {
    n: "4",
    what: "Run the $43,500 conveyor line.",
    detail:
      "Everything checks out, and it is held — not refused. No card exists while it waits. Typing a name is what creates it.",
    key: true,
  },
  {
    n: "5",
    what: "Tighten a rule, then hit replay.",
    detail:
      "Every past decision re-runs against the new policy, each flip showing what the rule expected before and after.",
  },
  {
    n: "6",
    what: "Try to approve your own rule change.",
    detail:
      "Propose under one name, activate under the same name. Refused. Someone else has to type theirs.",
  },
  {
    n: "7",
    what: "Hand over the keyboard.",
    detail:
      "Anyone can write their own purchase order — change the vendor, the item, a single cent — and press issue. Identical code path.",
  },
];

const STACK: { layer: string; tech: string }[] = [
  { layer: "Framework", tech: "Next.js 14 App Router, React 18, TypeScript 5.5" },
  { layer: "Payments", tech: "Rain issuing API — scoped virtual cards" },
  { layer: "Chain", tech: "Monad testnet via viem — rule-version hashes" },
  { layer: "Storage", tech: "Postgres on Neon, append-only decision log" },
  { layer: "Verify path", tech: "Plain TypeScript, no dependencies, no model" },
  { layer: "Money", tech: "Integer cents end to end, never a float" },
  { layer: "Negotiation", tech: "Deterministic strategy engine with price floors" },
  { layer: "Tests", tech: "tsx, 84 passing" },
];

// Led with "no human is involved" until the reframe, which put the human topic back at the
// top of the slide the reframe existed to demote. The trust question about the model is the
// one that actually decides whether any of this is believable, so it goes first — and the
// human row now answers with the proportion rather than conceding the premise.
const OBJECTIONS: { worry: string; answer: string }[] = [
  { worry: "The AI decides what's allowed", answer: "It decides nothing. It proposes; plain code rules." },
  { worry: "Your rules could be wrong", answer: "They're the three-way match your finance team already runs." },
  { worry: "You could just change the rules", answer: "Takes two people, and every version is kept and hashed." },
  { worry: "Are humans approving these?", answer: "35 of 41 had none. Above $25,000 one signs off — a boundary, not the model." },
];

const STATUS: { tone: "pass" | "warn" | "neutral"; state: string; items: string[] }[] = [
  {
    tone: "pass",
    state: "built and tested",
    items: [
      "Eleven checks, rule versioning, dual-control activation",
      "Replay across the entire decision log",
      "Append-only log with per-decision provenance",
      "The deterministic negotiation engine, and the run-it-twice refusal",
      "84 passing tests, with cases either side of every boundary",
    ],
  },
  {
    tone: "warn",
    state: "simulated, and labelled as such",
    items: [
      "Card issuance. The Rain client is written and wired, auth and endpoints confirmed against the sandbox — the outstanding piece is a linked collateral contract. Every simulated card says so on screen.",
    ],
  },
  {
    tone: "neutral",
    state: "written, waiting on config",
    items: [
      "The Monad anchor. The hash, the storage for its reference, and the route all exist; it needs a testnet RPC URL and a funded key.",
    ],
  },
];

const TEAM: { name: string; linkedin: string }[] = [
  { name: "Om Thakur", linkedin: "https://www.linkedin.com/in/theomthakur/" },
  { name: "Princy Doshi", linkedin: "https://www.linkedin.com/in/princy-doshi-071b581b3/" },
];

/** The hosts, as the event's own page lists them. */
const HOSTS: { name: string; role: string }[] = [
  { name: "Encode Club", role: "presented and ran the weekend" },
  { name: "Rain Events", role: "co-host, workshop, and mentors on the floor" },
  { name: "Monad Foundation", role: "co-host, settlement session, and the bounty" },
];

const TRACKS: { track: string; how: string }[] = [
  { track: "Best use of Rain", how: "Issuance is the enforcement point — Rain's own principle, one layer up." },
  { track: "Agents that move money", how: "One task, end to end: negotiate, propose, verify, issue, settle, file." },
  { track: "Agent negotiation", how: "The accepted quote becomes the PO the card is bound to. Negotiation causes what gets verified." },
  { track: "Monad", how: "Every rule version hashed and anchored, so policy cannot be backdated." },
];

/* ---------------------------------------------------------------- shared slide shell */

function Title({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-[27px] font-medium leading-[1.25] tracking-[-0.01em] text-ink-900 md:text-[34px]">
      {children}
    </h2>
  );
}

function Lede({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-muted">{children}</p>
  );
}

function Accent({ children }: { children: ReactNode }) {
  return <em className="not-italic text-rain-600">{children}</em>;
}

/* ---------------------------------------------------------------- the slides */

const SLIDES: Slide[] = [
  {
    id: "cover",
    label: "Mandate",
    eyebrow: "Team 10 · Raingentic Commerce Hackathon NYC",
    body: (
      <div className="flex h-full flex-col justify-center">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rain-500 text-xl font-bold text-white shadow-sm shadow-rain-500/20">
            M
          </span>
          <span className="font-display text-[38px] font-medium leading-none tracking-[-0.02em] text-ink-900">
            Mandate
          </span>
        </div>
        <h2 className="mt-7 max-w-3xl font-display text-[28px] font-medium leading-[1.3] tracking-[-0.01em] text-ink-900 md:text-[36px]">
          Rain bounds <Accent>how much</Accent> an agent spends and <Accent>where</Accent>.
          Mandate checks <Accent>why</Accent> — one step earlier, before the card exists.
        </h2>
        <p className="mt-6 max-w-2xl text-[14.5px] leading-relaxed text-muted">
          An agent gets a scoped virtual card bound to the exact purchase order it
          negotiated. If the declared order does not match the record, no card is created at
          all — not a decline, an instrument that never comes into existence.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-2">
          <Badge tone="rain">rain</Badge>
          <Badge tone="monad">monad</Badge>
          <Badge tone="pass">84 tests passing</Badge>
          <Badge tone="neutral">11 checks, all data</Badge>
        </div>
      </div>
    ),
  },
  {
    id: "problem",
    label: "The problem",
    eyebrow: "The problem",
    body: (
      <div>
        <Title>
          Every control passes. The purchase is still <Accent>wrong</Accent>.
        </Title>
        <Lede>
          Rain&apos;s Agent Control Layer already checks the rules before the card is
          created, rather than after the money is gone. But those rules can only describe
          how much, and where.
        </Lede>
        <Panel className="mt-6">
          <p className="border-l-2 border-rain-300 px-5 py-4 text-[15px] leading-relaxed text-ink-800">
            An agent with a $200 office-supply card can buy completely the wrong thing, at
            an allowed price, from an allowed shop, for a reason it made up.
          </p>
        </Panel>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { q: "How much?", who: "Rain answers this", ok: true },
            { q: "Where?", who: "Rain answers this", ok: true },
            { q: "Why?", who: "Nobody was asking", ok: false },
          ].map((c) => (
            <div
              key={c.q}
              className={`rounded-2xl border px-4 py-3.5 ${
                c.ok ? "border-edge bg-white" : "border-fail/25 bg-red-50/50"
              }`}
            >
              <p
                className={`font-display text-[19px] font-medium ${
                  c.ok ? "text-ink-900" : "text-fail"
                }`}
              >
                {c.q}
              </p>
              <p className="mt-1 text-[12.5px] text-muted">{c.who}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "solution",
    label: "What we built",
    eyebrow: "What we built",
    body: (
      <div>
        <Title>
          The agent has to say why before it can pay. Then plain code checks whether
          that&apos;s <Accent>true</Accent>.
        </Title>
        <Lede>
          Before any card exists, the agent hands over the purchase order it negotiated.
          Ordinary TypeScript — no model — compares that declaration against the company&apos;s
          real records.
        </Lede>
        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Panel title="What the agent must declare">
            <pre className="overflow-x-auto px-5 py-4 font-mono text-[12px] leading-relaxed text-ink-700">
              {`{
  poNumber:    "PO-4423",
  vendor:      "Beltworks Industrial",
  sku:         "BW-CONV-90",
  unitPrice:   1_450_00,
  quantity:    30,
  quoteExpiry: "2026-08-11T17:00:00Z"
}`}
            </pre>
          </Panel>
          <Panel title="What a mismatch produces">
            <div className="space-y-3 px-5 py-4 text-[13.5px] leading-relaxed text-ink-700">
              <p>
                <b className="text-ink-900">No card.</b> Not a declined payment — there is
                nothing to decline, because the instrument was never created.
              </p>
              <p>
                Nothing to cancel, nothing to dispute, nothing to claw back. The refusal
                branch never reaches Rain at all.
              </p>
              <p className="text-[13px] text-muted">
                It is a three-way match: the same PO / delivery / invoice cross-check every
                finance department already runs, moved from after the invoice arrives to
                before the card exists.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    ),
  },
  {
    id: "flow",
    label: "The flow",
    eyebrow: "The whole system, one diagram",
    body: (
      <div>
        <Title>
          Money moves only if step 3 passes — and for large purchases, only once a person
          has also said so.
        </Title>
        <div className="mt-6">
          <FlowDiagram />
        </div>
      </div>
    ),
  },
  {
    id: "checks",
    label: "The eleven checks",
    eyebrow: "The checks that decide it",
    body: (
      <div>
        <Title>
          Eleven checks. <Accent>None of them invented here.</Accent>
        </Title>
        <Lede>
          Each returns a sentence a human can act on, never &ldquo;validation failed&rdquo;.
          Each states the real-world control it implements, on screen and in the code.
        </Lede>
        <Panel className="mt-5">
          <ul className="divide-y divide-edge">
            {CHECKS.map((c, i) => (
              <li key={c.id} className="flex items-baseline gap-3 px-5 py-2.5">
                <span className="font-mono text-[11px] text-ink-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-ink-900">
                    {c.label}
                    {c.star && (
                      <span className="ml-2 align-middle">
                        <Badge tone="rain">the one that carries the demo</Badge>
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">{c.basis}</p>
                </div>
                <code className="shrink-0 font-mono text-[10.5px] text-ink-400">{c.id}</code>
              </li>
            ))}
          </ul>
        </Panel>
        <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-muted">
          Rule 4 is the one no card network can express at any granularity — an issuer has no
          idea your order system exists, so it cannot tell you that you bought the wrong item
          from the right shop at the right price.
        </p>
      </div>
    ),
  },
  {
    id: "replay",
    label: "Replay",
    eyebrow: "What four design decisions compose into",
    body: (
      <div>
        <Title>
          Change a rule, and re-run <Accent>all of history</Accent> against it.
        </Title>
        <Panel className="mt-6">
          <p className="px-6 py-6 font-display text-[22px] font-medium leading-[1.4] text-ink-900 md:text-[26px]">
            Across 60 recorded decisions, 9 that were approved would now be refused. 0
            refusals would now pass. 39 unchanged.
          </p>
        </Panel>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-edge bg-white px-4 py-3.5">
            <p className="text-[13.5px] font-semibold text-ink-900">Why it works</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              Rules are versioned data, checks are pure functions, and every decision saved a
              photograph of the records as they looked at that moment — not a link to records
              that have since changed.
            </p>
          </div>
          <div className="rounded-2xl border border-edge bg-white px-4 py-3.5">
            <p className="text-[13.5px] font-semibold text-ink-900">Why a pointer wouldn&apos;t</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              Replaying a link would judge today&apos;s facts against yesterday&apos;s
              decision and tell you nothing. This is the difference between an audit trail and
              a log.
            </p>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          Built in from the start, because a previous hackathon was lost to a team whose only
          real edge was an editable rules config and an instant re-run.
        </p>
      </div>
    ),
  },
  {
    id: "demo",
    label: "The demo",
    eyebrow: "Seven steps — the first four live, the rest on standby",
    body: (
      <div>
        <Title>
          The failure isn&apos;t staged. It&apos;s caused by the{" "}
          <Accent>first half of our own demo</Accent>.
        </Title>
        <Panel className="mt-5">
          <ol className="divide-y divide-edge">
            {DEMO.map((d) => (
              <li
                key={d.n}
                className={`flex items-start gap-3.5 px-5 py-2.5 ${d.key ? "bg-rain-50/40" : ""}`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold ${
                    d.key ? "border-rain-500 text-rain-600" : "border-edge text-ink-400"
                  }`}
                >
                  {d.n}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-ink-900">{d.what}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{d.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          Steps 2 and 4 are the ones that answer &ldquo;why would I trust this?&rdquo; — and
          they answer it by being refused and held on stage, not by being asserted.
        </p>
      </div>
    ),
  },
  {
    id: "human",
    label: "The human",
    eyebrow: "The first objection",
    body: (
      <div>
        <Title>
          There is a human — <Accent>above a limit you set</Accent>.
        </Title>
        <Lede>
          No company gives an employee unlimited authority either. It gives bounded autonomy
          with an escalation path. An agent gets the same deal: above $25,000 a purchase is
          held, not refused.
        </Lede>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            {
              h: "No card exists while it waits",
              p: "Approving is what creates the instrument. A rejected escalation has nothing to cancel.",
            },
            {
              h: "The approver must be named",
              p: "An unattributed approval is not an approval. Someone accepted responsibility.",
            },
            {
              h: "Releasing re-runs every check",
              p: "The world moves while things sit in queues. Approval is permission, not a promise the facts held.",
            },
          ].map((d) => (
            <div key={d.h} className="rounded-2xl border border-edge bg-white px-4 py-3.5">
              <p className="text-[13.5px] font-semibold text-ink-900">{d.h}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{d.p}</p>
            </div>
          ))}
        </div>
        <Panel className="mt-4">
          <p className="px-5 py-4 text-[13.5px] leading-relaxed text-ink-700">
            If two approvers both hit release, the second is refused — by rule 6, reading the
            record the first release wrote. Idempotency protecting a{" "}
            <b className="text-ink-900">human</b> race, not just a machine retry.
          </p>
        </Panel>
      </div>
    ),
  },
  {
    id: "rules-integrity",
    label: "Changing rules",
    eyebrow: "The sharpest objection",
    body: (
      <div>
        <Title>
          &ldquo;Then couldn&apos;t you just change the rules?&rdquo; It takes{" "}
          <Accent>two people</Accent>, and every version is kept.
        </Title>
        <Lede>
          This is the criticism that would make the whole audit worthless, so it gets a
          control rather than a reassurance.
        </Lede>
        <Panel className="mt-6">
          <ul className="divide-y divide-edge">
            {[
              {
                h: "A rule change lands as pending, and decides nothing",
                p: "The active version keeps governing until someone approves the new one.",
              },
              {
                h: "The author cannot be the approver",
                p: "Segregation of duties — the same control that stops whoever raises an invoice from also paying it.",
              },
              {
                h: "Every version is kept and hashed",
                p: "sha256 per version, anchored on Monad testnet, so a policy cannot be quietly backdated to fit a history you already have.",
              },
            ].map((r) => (
              <li key={r.h} className="px-5 py-3.5">
                <p className="text-[13.5px] font-medium text-ink-900">{r.h}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{r.p}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone="monad">rule versions anchored on monad</Badge>
          <Badge tone="neutral">policy is data, not a deploy</Badge>
        </div>
      </div>
    ),
  },
  {
    id: "objections",
    label: "Objections",
    eyebrow: "Asked and answered",
    body: (
      <div>
        <Title>
          Four worries, four <Accent>controls</Accent> — not four reassurances.
        </Title>
        <Panel className="mt-6">
          <ul className="divide-y divide-edge">
            {OBJECTIONS.map((o) => (
              <li key={o.worry} className="grid gap-1 px-5 py-4 sm:grid-cols-2 sm:gap-6">
                <p className="text-[14px] font-medium text-ink-900">{o.worry}</p>
                <p className="text-[13.5px] leading-relaxed text-ink-700">{o.answer}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-muted">
          Most &ldquo;AI safety&rdquo; claims ask you to trust a model&apos;s judgement about
          a model. There is no model anywhere in the decision path here, so this one does not
          ask that at all.
        </p>
      </div>
    ),
  },
  {
    id: "stack",
    label: "The stack",
    eyebrow: "Built with",
    body: (
      <div>
        <Title>
          Every choice was forced by the problem, not by <Accent>taste</Accent>.
        </Title>
        <Panel className="mt-6">
          <ul className="divide-y divide-edge">
            {STACK.map((s) => (
              <li key={s.layer} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-5 py-2.5">
                <p className="w-28 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {s.layer}
                </p>
                <p className="text-[13.5px] font-medium text-ink-800">{s.tech}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          The palette is sampled from Rain&apos;s and Monad&apos;s own stylesheets rather than
          guessed — #ff2fb6 and #6e54ff are their real brand values.
        </p>
      </div>
    ),
  },
  {
    id: "status",
    label: "Status",
    eyebrow: "Stated plainly",
    body: (
      <div>
        <Title>
          What is real, what is simulated, and <Accent>where it says so</Accent>.
        </Title>
        <div className="mt-6 space-y-3">
          {STATUS.map((s) => (
            <Panel key={s.state}>
              <div className="px-5 py-4">
                <Badge tone={s.tone}>{s.state}</Badge>
                <ul className="mt-2.5 space-y-1.5">
                  {s.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-700"
                    >
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-300" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "close",
    label: "Close",
    eyebrow: "One build, four tracks",
    body: (
      <div className="flex h-full flex-col justify-center">
        <h2 className="max-w-3xl font-display text-[26px] font-medium leading-[1.3] tracking-[-0.01em] text-ink-900 md:text-[32px]">
          Rain bounds how much an agent spends and where. Mandate checks{" "}
          <Accent>why</Accent> — and if the reason doesn&apos;t hold, the card is never
          issued.
        </h2>
        <Panel className="mt-7">
          <ul className="divide-y divide-edge">
            {TRACKS.map((t) => (
              <li key={t.track} className="grid gap-1 px-5 py-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6">
                <p className="text-[13.5px] font-semibold text-rain-700">{t.track}</p>
                <p className="text-[13px] leading-relaxed text-ink-700">{t.how}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <p className="mt-5 text-[13px] leading-relaxed text-muted">
          The console is one click away, and every claim on these slides is a screen in it.
        </p>
      </div>
    ),
  },
  {
    id: "thanks",
    label: "Thank you",
    eyebrow: "Team 10",
    body: (
      <div className="flex h-full flex-col justify-center">
        <h2 className="font-display text-[40px] font-medium leading-none tracking-[-0.02em] text-ink-900 md:text-[52px]">
          Thank you.
        </h2>
        <p className="mt-5 max-w-2xl text-[14.5px] leading-relaxed text-muted">
          To <b className="font-medium text-ink-900">Encode Club</b>,{" "}
          <b className="font-medium text-ink-900">Rain</b> and the{" "}
          <b className="font-medium text-ink-900">Monad Foundation</b> for the weekend, the
          workshops, and for answering our questions on the floor rather than in a doc.
          Built in New York, 8–9 August 2026.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {HOSTS.map((h) => (
            <div key={h.name} className="rounded-2xl border border-edge bg-white px-4 py-3.5">
              <p className="text-[13.5px] font-semibold text-ink-900">{h.name}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{h.role}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Team 10
          </p>
          {TEAM.map((m) => (
            <a
              key={m.name}
              href={m.linkedin}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-2 rounded-full border border-edge bg-white py-1.5 pl-4 pr-3.5 transition hover:border-ink-300"
            >
              <span className="font-display text-[17px] font-medium text-ink-900">
                {m.name}
              </span>
              <LinkedinIcon className="h-3.5 w-3.5 text-ink-300 transition group-hover:text-rain-600" />
            </a>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
          <a
            href="https://github.com/theomthakur/raingentic-team10"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 font-medium text-muted transition hover:text-ink-900"
          >
            <GithubIcon className="h-4 w-4" />
            theomthakur/raingentic-team10
          </a>
          <span className="text-muted">Questions welcome — including the hard ones.</span>
        </div>
      </div>
    ),
  },
];

/* ---------------------------------------------------------------- the deck itself */

export function Deck() {
  const [index, setIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const total = SLIDES.length;
  const slide = SLIDES[index];

  const next = useCallback(() => setIndex((i) => Math.min(total - 1, i + 1)), [total]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Arrow keys are how anyone presents anything. Space too, because that is what a clicker
  // sends. Nothing here is a text field, so there is no input to guard against.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          prev();
          break;
        case "Home":
          e.preventDefault();
          setIndex(0);
          break;
        case "End":
          e.preventDefault();
          setIndex(total - 1);
          break;
        case "f":
        case "F":
          e.preventDefault();
          void toggleFullscreen();
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, total]);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement === frameRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    const el = frameRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      // Some browsers refuse without a direct gesture. Not worth an error state on a deck.
    }
  }

  return (
    <div
      ref={frameRef}
      className={`bg-white ${isFullscreen ? "flex flex-col justify-center overflow-y-auto" : ""}`}
    >
      <div className="mx-auto w-full max-w-[1100px] px-6 py-7 md:px-10">
        {/* Controls first: a presenter needs to find them without looking. */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="tabular font-mono text-[12px] text-ink-400">
              {String(index + 1).padStart(2, "0")} / {total}
            </span>
            <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-400">
              {slide.eyebrow}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={prev} disabled={index === 0} title="Previous slide (←)">
              ←
            </Button>
            <Button
              onClick={next}
              variant="primary"
              disabled={index === total - 1}
              title="Next slide (→)"
            >
              →
            </Button>
            <Button onClick={toggleFullscreen} variant="ghost" title="Fullscreen (F)">
              {isFullscreen ? "Exit fullscreen" : "Present"}
            </Button>
          </div>
        </div>

        {/* Progress rail. Segments, not a bar, so you can see how much deck is left. */}
        <div className="mt-4 flex gap-1" role="tablist" aria-label="Slides">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}: ${s.label}`}
              title={s.label}
              onClick={() => setIndex(i)}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i === index
                  ? "bg-rain-500"
                  : i < index
                    ? "bg-rain-200 hover:bg-rain-300"
                    : "bg-ink-200 hover:bg-ink-300"
              }`}
            />
          ))}
        </div>

        <p className="sr-only" aria-live="polite">
          Slide {index + 1} of {total}: {slide.label}
        </p>

        <div
          key={slide.id}
          className="animate-row-in mt-8 flex min-h-[520px] flex-col pb-2"
          role="tabpanel"
          aria-label={slide.label}
        >
          {slide.body}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4 text-[12px] text-muted">
          <p>
            <kbd className="font-mono text-[11px] text-ink-500">←</kbd>{" "}
            <kbd className="font-mono text-[11px] text-ink-500">→</kbd> to move ·{" "}
            <kbd className="font-mono text-[11px] text-ink-500">F</kbd> to present
          </p>
          <p className="font-mono text-[11px] text-ink-400">{slide.label.toLowerCase()}</p>
        </div>
      </div>
    </div>
  );
}
