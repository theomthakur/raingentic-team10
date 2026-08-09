"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Decision } from "@/lib/types";
import { poTotal } from "@/lib/types";
import { money } from "@/lib/format";
import { AGENTS } from "@/lib/agents";
import { AgentAvatar } from "@/components/identity/AgentAvatar";
import { Badge, Panel } from "@/components/ui";
import { Footer } from "@/components/layout/Footer";
import { SubPageHeader } from "@/components/layout/SiteNav";

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
    <Panel className="group relative overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-ink-900/[0.06]">
      <div className="h-1" style={{ backgroundColor: agent.color }} />
      <div className="flex items-start gap-4 p-5">
        <AgentAvatar id={id} size={48} className="ring-4 ring-white" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[16px] font-semibold tracking-tight text-ink-900">{agent.name}</p>
              <p className="mt-0.5 text-[12.5px] font-medium" style={{ color: agent.color }}>
                {agent.role}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5">
              {agent.host && <Badge tone="rain">for {agent.host}</Badge>}
            </span>
          </div>
          <p className="mt-2 text-[12px] font-medium text-ink-500">Owns {agent.dealsWith}</p>
          <p className="mt-3 rounded-xl border border-edge bg-ink-50/70 px-3 py-2.5 text-[13px] font-medium leading-relaxed text-ink-700">
            “{agent.assurance}”
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-700">{agent.description}</p>

          <p
            className="mt-3 border-l-2 pl-3 text-[12px] italic leading-relaxed text-muted"
            style={{ borderColor: `${agent.color}55` }}
          >
            Named for — {agent.why}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-edge pt-3.5">
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

  // Host tributes first — Rain, then Monad, then Encode — so the people who ran this
  // event see themselves at the top of the roster rather than three cards down.
  const ids = useMemo(() => {
    const hostOrder = { Rain: 0, Monad: 1, Encode: 2 } as const;
    // `catalog` is a person buying by hand, not an agent, so it stays off the roster.
    return Object.keys(AGENTS).filter((k) => k !== "catalog").sort((a, b) => {
      const ha = AGENTS[a].host;
      const hb = AGENTS[b].host;
      if (ha && hb) return hostOrder[ha] - hostOrder[hb];
      if (ha) return -1;
      if (hb) return 1;
      return 0;
    });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <SubPageHeader current="/agents" />

      <main className="mx-auto max-w-[1100px] px-6 py-10 md:px-10">
        <section className="mb-8">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-400">Who's spending</p>
          <h1 className="mt-3 font-display text-[30px] font-medium leading-tight tracking-[-0.01em] text-ink-900">
            Five agents, five roles — the same eleven checks
          </h1>
          <div className="mt-5 grid w-full gap-4 rounded-2xl border border-edge bg-ink-50/55 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
            <p className="max-w-3xl text-[14px] leading-relaxed text-muted">
              Each specialist owns a category and can act without a person clicking through
              supplier pages. Every order still runs through the same eleven Mandate checks.
              The activity below comes from the shared decision log—not a hand-written demo.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-edge pt-3 text-[11.5px] font-medium text-ink-600 sm:justify-end sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
              <span><strong className="text-ink-900">5</strong> specialists</span>
              <span><strong className="text-ink-900">11</strong> checks each</span>
              <span><strong className="text-ink-900">1</strong> shared log</span>
            </div>
          </div>
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
