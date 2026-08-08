import Link from "next/link";
import { Badge, Panel } from "@/components/ui";
import { SystemDiagram } from "@/components/explain/SystemDiagram";
import { FlowDiagram } from "@/components/explain/FlowDiagram";
import { TechStack } from "@/components/explain/TechStack";
import { ControlCoverage } from "@/components/explain/ControlCoverage";
import { Footer } from "@/components/layout/Footer";
import { PAGES, SubPageHeader } from "@/components/layout/SiteNav";

export const metadata = {
  title: "Mandate — system design",
};

const CHECKS = [
  { id: "po-exists", label: "PO exists and is accepted", detail: "The declared purchase order has to be on record, and the quote behind it has to actually be accepted — not just sent." },
  { id: "po-open", label: "PO still open and the quote has not expired", detail: "A quote is a promise with a deadline. Past it, the price is not guaranteed to still be true." },
  { id: "amount-matches", label: "Amount matches the accepted quote", detail: "The requested total has to match what was quoted, within a small tolerance — not whatever the agent now claims." },
  { id: "line-matches", label: "Vendor and SKU match the accepted quote", detail: "Right price, wrong item, is still wrong. Catches an agent that quietly substitutes what it's buying." },
  { id: "within-budget", label: "Within the cost centre's remaining budget", detail: "Checked against the real remaining balance at the moment of the request, not a cached figure." },
  { id: "no-existing-card", label: "No card already issued for this PO", detail: "Idempotency. Submit the same PO twice and the second run is refused by the record the first run itself wrote." },
  { id: "requires-approval", label: "Above the delegated limit, a person must release it", detail: "Over $25,000 the purchase is held rather than refused. Nothing is wrong with it — it is simply larger than any agent's unattended authority." },
  { id: "no-structuring", label: "Not a large purchase split to duck approval", detail: "The obvious way to beat the limit above is to buy twice, just under it each time. So the ceiling applies to the running total on one supplier and cost centre, not to a single line in isolation." },
  { id: "agent-authority", label: "Inside this particular agent's own limit", detail: "A single global ceiling would give the agent buying stationery the same authority as the one buying capital equipment. Limits are per-agent, exactly as a delegation matrix is per-role." },
  { id: "known-vendor", label: "A supplier we have paid before", detail: "A first payment to a new supplier is ordinary business, and it is also what invoice fraud looks like. Held once, not refused." },
  { id: "velocity", label: "Not spending faster than this agent should", detail: "An agent stuck in a loop makes purchases that are each individually perfect. Nothing is wrong with any one of them; only the rate is wrong, so only a rate limit sees it." },
];

const CATEGORIES = [
  { cat: "Best use of Rain", how: "Card issuance is the enforcement point — matching Rain's own published principle of enforcing \"at issuance, rather than applied after the fact.\"" },
  { cat: "General track — agents that move money", how: "An agent runs a task end to end: negotiate, propose, verify, issue, settle. Every decision is filed." },
  { cat: "Agent negotiation", how: "Competing sellers with distinct strategies and one counter-offer round produce the accepted PO the card is bound to — negotiation causes what gets verified, not something staged beside it." },
  { cat: "Monad bounty", how: "Every rule version is hashed and anchored on testnet, which is what proves the rules were not quietly rewritten to fit a history after the fact." },
];

const NOT_BUILT = [
  { name: "Delegated budget trees", why: "Sits too close to Rain's own program-level caps — would read as rebuilding their product rather than extending it." },
  { name: "A second collateral pool (\"agent underwriting\")", why: "Needs a Rain identity the team was not issued for this event." },
  { name: "Live streaming spend limits", why: "Needs an unconfirmed Rain capability plus a Monad contract written from scratch — two coupled unknowns in one afternoon." },
  { name: "Multi-agent consensus voting on a decision", why: "Rejected on principle: LLM agents voting reintroduces a model into the verify path, which is exactly what makes replay meaningless." },
];

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-white">
      <SubPageHeader current="/architecture" />

      <main className="mx-auto max-w-[1100px] px-6 py-10 md:px-10">
        <section className="mb-10">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-400">
            What this is
          </p>
          <h1 className="mt-3 font-display text-[32px] font-medium leading-[1.25] tracking-[-0.01em] text-ink-900 md:text-[38px]">
            Rain bounds <em className="not-italic text-rain-600">how much</em> an agent
            spends and <em className="not-italic text-rain-600">where</em>. Mandate checks{" "}
            <em className="not-italic text-rain-600">why</em> — one step earlier, before the
            card exists.
          </h1>
          <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-muted">
            An agent gets a scoped virtual Rain card bound to the exact purchase order it
            negotiated. Deterministic code checks the declared order against the real record
            before the card is ever created. Any mismatch means no card, not a decline —
            an instrument that never comes into existence in the first place.
          </p>
        </section>

        {/* The site grew a page at a time and it was no longer obvious what any of them
            were for, or which one you were meant to start on. Driven off the same PAGES
            array the nav uses, so the two can never drift apart. */}
        <section className="mb-10">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">
            The six pages, and what each one is for
          </p>
          <Panel>
            <ol className="divide-y divide-edge">
              {PAGES.map((page, i) => (
                <li key={page.href} className="flex items-baseline gap-4 px-5 py-3">
                  <span className="w-4 shrink-0 font-mono text-[11px] text-ink-400">
                    {i + 1}
                  </span>
                  <Link
                    href={page.href}
                    className="w-32 shrink-0 text-[14px] font-medium text-rain-600 hover:text-rain-700"
                  >
                    {page.label}
                  </Link>
                  <span className="flex-1 text-[13.5px] text-muted">{page.blurb}</span>
                  <code className="hidden shrink-0 font-mono text-[11px] text-ink-300 sm:block">
                    {page.href}
                  </code>
                </li>
              ))}
            </ol>
          </Panel>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            Two of these are the product and the rest explain it.{" "}
            <strong className="font-medium text-ink-900">Workspace</strong> is what someone
            who buys this would use day to day — plain language, approvals, budgets.{" "}
            <strong className="font-medium text-ink-900">Console</strong> is the same system
            with its working shown: every check, every record it read, and the controls to
            change policy and re-judge history. Same data, same API, same decisions.
          </p>
        </section>

        <section className="mb-10">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">
            The whole system, one diagram
          </p>
          <FlowDiagram />
        </section>

        <section className="mb-10">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">
            Step by step
          </p>
          <SystemDiagram />
        </section>

        <section className="mb-10">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">
            What it is built with
          </p>
          <TechStack />
        </section>

        <section className="mb-10">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">
            The eleven checks that decide step 3
          </p>
          {/* The framing that makes the last four checks make sense. Without it they look
              like extra validation; with it they are the answer to a player who is trying
              to win rather than trying to lie. */}
          <p className="mb-3 max-w-2xl text-[14px] leading-relaxed text-ink-700">
            Every check here assumes the agent is playing to win. Splitting a purchase to
            duck an approval limit isn&apos;t a lie — every individual line is true — it&apos;s a
            strategy. So the last four check the{" "}
            <strong className="font-semibold text-ink-900">pattern</strong>, not the move.
          </p>
          <Panel>
            <ul className="divide-y divide-edge">
              {CHECKS.map((c, i) => (
                <li key={c.id} className="px-5 py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13.5px] font-medium text-ink-900">
                      <span className="mr-1.5 font-mono text-[11px] text-ink-400">{i + 1}</span>
                      {c.label}
                    </p>
                    <code className="shrink-0 font-mono text-[10.5px] text-ink-400">{c.id}</code>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{c.detail}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <section className="mb-10">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">
            Why Rain, specifically
          </p>
          <Panel>
            <div className="space-y-3 px-5 py-4 text-[14px] leading-relaxed text-ink-700">
              <p>
                Rain is a Visa and Mastercard Principal Member — it issues cards directly
                rather than reselling someone else's licence — live across 175 million
                merchant locations in 220+ countries. Its newest product, the{" "}
                <b className="text-ink-900">Agent Control Layer</b>, enforces amount limits,
                merchant allowlists, and spend intervals{" "}
                <b className="text-ink-900">
                  "at card issuance and transfer initiation, rather than applied after the
                  fact."
                </b>
              </p>
              <p>
                That phrase is Mandate's whole thesis, carried one layer higher: from{" "}
                <i>can this agent spend this much, here</i>, to{" "}
                <i>is this specific declared reason for spending actually true</i>. Mandate
                does not compete with the Agent Control Layer — it sits on top of it, using
                the same collateral-backed issue → settle → revoke flow shown in Rain's own
                reference demo.
              </p>
            </div>
          </Panel>
        </section>

        <section className="mb-10">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">
            Where Mandate ends and Rain begins
          </p>
          <ControlCoverage />
        </section>

        <section className="mb-10">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">
            How it covers the submission tracks
          </p>
          <Panel>
            <ul className="divide-y divide-edge">
              {CATEGORIES.map((c) => (
                <li key={c.cat} className="px-5 py-3.5">
                  <p className="text-[13.5px] font-semibold text-rain-700">{c.cat}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-700">{c.how}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <section className="mb-10">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">
            What we deliberately didn't build
          </p>
          <Panel>
            <ul className="divide-y divide-edge">
              {NOT_BUILT.map((n) => (
                <li key={n.name} className="px-5 py-3.5">
                  <p className="text-[13.5px] font-medium text-ink-900">{n.name}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{n.why}</p>
                </li>
              ))}
            </ul>
          </Panel>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            This scoping follows from a prior hackathon loss: the team once built roughly
            85% of a winning system's substance and still lost, to a team whose actual edge
            was a versioned, editable rules config and an instant re-run. The replay feature
            here is that same idea, built from the start rather than bolted on after losing
            to it once.
          </p>
        </section>

        <section>
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">
            Status, stated plainly
          </p>
          <Panel>
            <p className="px-5 py-4 text-[13.5px] leading-relaxed text-ink-700">
              The checks, rule versioning, replay, the append-only log, the negotiation
              engine, and the run-it-twice refusal are all built and tested (29 passing
              tests). Card issuance currently returns a{" "}
              <Badge tone="warn">simulated</Badge> card, labelled as such in the console,
              because the Rain endpoint paths are still being confirmed on site — the client
              is written and wired, so switching it on is one function swap once confirmed.
              The Monad anchor transaction is{" "}
              <Badge tone="neutral">not yet written</Badge>; the hash and the storage for its
              reference already exist.
            </p>
          </Panel>
        </section>
      </main>

      <Footer />
    </div>
  );
}
