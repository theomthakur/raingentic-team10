"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Decision } from "@/lib/types";
import { poTotal } from "@/lib/types";
import { money } from "@/lib/format";
import { AGENTS } from "@/lib/agents";
import { AgentAvatar } from "@/components/AgentAvatar";
import { Badge, Panel } from "@/components/ui";
import { Footer } from "@/components/Footer";

/**
 * The roster. Every stat here is counted off the live decision log, not written by hand —
 * this page can't drift out of sync with what the console shows, because it reads the same
 * state the console does.
 */

function AgentCard({ id, decisions }: { id: string; decisions: Decision[] }) {
  const agent = AGENTS[id];
  const mine = decisions.filter((d) => d.agent === id);
  const approved = mine.filter((d) => d.outcome === "approved").length;
  const held = mine.filter((d) => d.outcome === "held").length;
  const refused = mine.filter((d) => d.outcome === "refused").length;
  const totalSpend = mine.filter((d) => d.outcome === "approved").reduce((sum, d) => sum + poTotal(d.po), 0);

  return (
    <Panel>
      <div className="flex items-start gap-3.5 p-5">
        <AgentAvatar id={id} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[15px] font-semibold text-ink-900">
              This is {agent.name}
            </p>
            <span className="font-mono text-[10.5px] text-ink-400">{agent.id}</span>
          </div>
          <p className="text-[12.5px] font-medium" style={{ color: agent.color }}>
            {agent.role} — deals with {agent.dealsWith}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-700">{agent.description}</p>

          <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{mine.length} decisions</Badge>
            {approved > 0 && <Badge tone="pass">{approved} approved</Badge>}
            {held > 0 && <Badge tone="warn">{held} held</Badge>}
            {refused > 0 && <Badge tone="fail">{refused} refused</Badge>}
          </div>
          {totalSpend > 0 && (
            <p className="tabular mt-2 font-mono text-[12px] text-ink-500">
              {money(totalSpend)} cleared to date
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default function AgentsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);

  useEffect(() => {
    fetch("/api/state", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setDecisions(data.decisions ?? []))
      .catch(() => setDecisions([]));
  }, []);

  const ids = useMemo(() => Object.keys(AGENTS), []);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-edge bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-6 py-5 md:px-10">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[13px] font-medium text-muted transition hover:text-ink-900"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rain-500 text-[12px] font-bold text-white">
              M
            </span>
            ← Back to Mandate
          </Link>
          <Badge tone="neutral">agents</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 py-10 md:px-10">
        <section className="mb-8">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-400">Who's spending</p>
          <h1 className="mt-3 font-display text-[30px] font-medium leading-tight tracking-[-0.01em] text-ink-900">
            Five agents, five roles — the same six checks
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted">
            Every purchase order in the log was declared by one of these. The id is what
            the system actually keys on; the name is just so the feed reads like a team
            doing work rather than a service account making requests. Stats below are
            counted live off the decision log, not written by hand.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {ids.map((id) => (
            <AgentCard key={id} id={id} decisions={decisions} />
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
