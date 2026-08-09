"use client";

import { useRef, useState } from "react";
import type { CatalogProduct } from "@/lib/catalog";
import type { Decision } from "@/lib/types";
import type { Stage } from "@/lib/pipeline";
import { money } from "@/lib/format";
import { getAgent } from "@/lib/agents";
import { AgentAvatar } from "@/components/identity/AgentAvatar";
import { Badge, Button, Panel } from "@/components/ui";

/**
 * The agent running with nobody watching it.
 *
 * Every other surface here starts with a person asking for something. This one does not.
 * You give it a standing objective and press go, and it decides what to buy, buys it,
 * gets refused, and decides again — unattended, inside the limits already set.
 *
 * That is the claim worth making: **autonomy is safe not because the agent is good, but
 * because being wrong is bounded.** The agent picks freely and is allowed to pick badly.
 * What it picked then goes through the same eleven deterministic checks as anything a
 * person asked for. A bad decision cannot become a bad payment.
 *
 * Which is also why the refusals during a run are the good part, not the failure. A run
 * where the agent gets stopped twice is a better demonstration than one where it doesn't.
 */

interface Attempt {
  reasoning: string;
  productName: string;
  quantity: number;
  outcome?: Decision["outcome"];
  detail?: string;
  totalCents?: number;
  agentId?: string;
}

const MAX_STEPS = 5;

export function Autopilot({ catalog }: { catalog: CatalogProduct[] }) {
  const [objective, setObjective] = useState(
    "Keep the office and engineering teams supplied for the week without exhausting any budget."
  );
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState<string | null>(null);
  const stop = useRef(false);

  async function run() {
    setAttempts([]);
    setFinished(null);
    setRunning(true);
    stop.current = false;

    const bought: string[] = [];

    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        if (stop.current) break;

        // 1. The agent decides, on its own.
        const planRes = await fetch("/api/autopilot", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ objective, alreadyBought: bought }),
        });
        const plan = await planRes.json();
        if (plan.done || !plan.productId) {
          setFinished(plan.reasoning ?? "The agent decided it was finished.");
          break;
        }

        const product = catalog.find((p) => p.id === plan.productId);
        if (!product) break;
        bought.push(product.id);

        const attempt: Attempt = {
          reasoning: plan.reasoning,
          productName: product.name,
          quantity: plan.quantity,
          agentId: product.agent,
        };
        setAttempts((a) => [...a, attempt]);

        // 2. The same endpoints, the same checks. No autopilot path around them.
        const url = product.kind === "negotiated" ? "/api/purchase" : "/api/run";
        const body =
          product.kind === "negotiated"
            ? {
                taskKey: product.taskKey,
                quantity: plan.quantity,
                targetPriceCents: Math.round(product.fromCents * 0.93),
                costCentre: product.costCentre,
                validForDays: 3,
              }
            : {
                po: {
                  poNumber: product.poNumber,
                  vendor: product.vendor,
                  sku: product.sku,
                  unitPrice: product.fromCents,
                  quantity: plan.quantity,
                  quoteExpiry: new Date(Date.now() + 3 * 864e5).toISOString(),
                  costCentre: product.costCentre,
                },
                agent: product.agent,
              };

        const runRes = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await runRes.json();

        setAttempts((a) => {
          const next = [...a];
          const last = next[next.length - 1];
          if (!runRes.ok || !data.decision) {
            last.outcome = "refused";
            last.detail = data.error ?? "The purchase could not be attempted.";
          } else {
            const d = data.decision as Decision;
            const stages = data.stages as Stage[];
            last.outcome = d.outcome;
            last.totalCents = d.po.unitPrice * d.po.quantity;
            const closing =
              stages.find((s) => s.name === "REFUSE") ??
              stages.find((s) => s.name === "HOLD") ??
              stages.find((s) => s.name === "REVOKE");
            last.detail = closing?.detail;
          }
          return next;
        });

        await new Promise((r) => setTimeout(r, 700));
      }
    } finally {
      setRunning(false);
    }
  }

  const spent = attempts
    .filter((a) => a.outcome === "approved")
    .reduce((sum, a) => sum + (a.totalCents ?? 0), 0);
  const stopped = attempts.filter((a) => a.outcome === "refused" || a.outcome === "held").length;

  return (
    <Panel
      title="Let it run on its own"
      right={
        running ? (
          <Button variant="ghost" onClick={() => (stop.current = true)}>
            Stop
          </Button>
        ) : (
          <Button variant="primary" onClick={run}>
            {attempts.length ? "Run again" : "Run unattended"}
          </Button>
        )
      }
    >
      <div className="border-b border-edge px-5 py-4">
        <p className="text-[12.5px] leading-relaxed text-muted">
          No one types a request here. Give the agent a standing objective and it decides
          what to buy, buys it, gets refused, and decides again — inside the limits you
          already set.
        </p>
        <label className="mt-3 block">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-400">
            standing objective
          </span>
          <textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            disabled={running}
            rows={2}
            className="mt-1 w-full resize-none rounded-xl border border-edge bg-white px-3 py-2 text-[13px] leading-relaxed text-ink-900 outline-none focus:border-rain-400 focus:ring-2 focus:ring-rain-100 disabled:bg-ink-50"
          />
        </label>
      </div>

      {attempts.length > 0 && (
        <ul className="divide-y divide-edge">
          {attempts.map((a, i) => {
            const agent = a.agentId ? getAgent(a.agentId) : null;
            const tone =
              a.outcome === "approved"
                ? { badge: "pass" as const, label: "bought" }
                : a.outcome === "held"
                  ? { badge: "warn" as const, label: "held for a person" }
                  : a.outcome === "refused"
                    ? { badge: "fail" as const, label: "stopped" }
                    : null;

            return (
              <li key={i} className="animate-row-in px-5 py-3.5">
                <div className="flex items-start gap-3">
                  {agent && <AgentAvatar id={agent.id} size={26} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[13.5px] font-medium text-ink-900">
                        {a.quantity} × {a.productName}
                      </p>
                      {tone ? (
                        <Badge tone={tone.badge}>{tone.label}</Badge>
                      ) : (
                        <span className="text-[11.5px] text-rain-600">deciding…</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12.5px] italic leading-relaxed text-muted">
                      “{a.reasoning}”
                    </p>
                    {a.detail && (
                      <p
                        className={`mt-1 text-[12.5px] leading-relaxed ${
                          a.outcome === "approved"
                            ? "text-ink-600"
                            : a.outcome === "held"
                              ? "text-warn"
                              : "text-fail"
                        }`}
                      >
                        {a.detail}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(finished || (!running && attempts.length > 0)) && (
        <div className="border-t border-edge bg-ink-50/60 px-5 py-3.5">
          <p className="text-[13px] text-ink-800">
            <strong>{money(spent)}</strong> spent across{" "}
            {attempts.filter((a) => a.outcome === "approved").length} purchases, with{" "}
            <strong>{stopped}</strong> stopped before a card could exist.
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            Nobody approved any of that. The agent chose freely and the checks decided
            — which is the only reason it is safe to let it choose freely.
          </p>
          {finished && <p className="mt-1 text-[12.5px] text-ink-500">{finished}</p>}
        </div>
      )}
    </Panel>
  );
}
