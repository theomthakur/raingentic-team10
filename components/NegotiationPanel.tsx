"use client";

import type { NegotiationSummary } from "@/lib/types";
import { money } from "@/lib/format";
import { Badge, Panel } from "./ui";

/**
 * What the sellers did, and what it cost.
 *
 * The visual point is the gap between each seller's opening price and where they landed
 * after one counter-offer round. A firm seller barely moves; a discounter drops hard and
 * still loses; someone hits their floor. That spread is what makes the strategies legible
 * as strategies rather than as four random numbers.
 *
 * And the line at the bottom is the one that matters: the winning number becomes the
 * purchase order everything downstream is checked against. Negotiation is not running
 * beside the verification — it produces the thing being verified.
 */
export function NegotiationPanel({
  negotiation,
  poNumber,
  totalCents,
}: {
  negotiation: NegotiationSummary;
  poNumber?: string;
  totalCents?: number;
}) {
  const { offers, buyerTargetCents, roundCount } = negotiation;
  const winner = offers.find((o) => o.won);

  // Scale the bars against the widest opening price so concessions are comparable.
  const maxPrice = Math.max(...offers.map((o) => o.opening), 1);

  return (
    <Panel
      title="Negotiation"
      right={
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{offers.length} sellers</Badge>
          <Badge tone="neutral">
            {roundCount} counter-offer round{roundCount === 1 ? "" : "s"}
          </Badge>
        </div>
      }
    >
      <p className="border-b border-edge px-4 py-2 text-[12px] text-muted">
        Buyer opened at{" "}
        <span className="tabular font-mono text-slate-300">{money(buyerTargetCents)}</span>{" "}
        per unit. Sellers concede by their own strategy, and none goes below its floor.
      </p>

      <ul className="divide-y divide-edge/60">
        {offers.map((o) => {
          const moved = o.opening - o.final;
          const movedPct = o.opening === 0 ? 0 : (moved / o.opening) * 100;
          return (
            <li key={o.vendor} className={`px-4 py-2.5 ${o.won ? "bg-pass/5" : ""}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span
                    className={`truncate text-[13px] ${
                      o.won ? "font-semibold text-pass" : "text-slate-300"
                    }`}
                  >
                    {o.vendor}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-slate-600">
                    {o.label}
                  </span>
                </span>
                <span className="tabular shrink-0 font-mono text-[12px]">
                  <span className="text-slate-600 line-through">{money(o.opening)}</span>
                  <span className="mx-1.5 text-slate-600">→</span>
                  <span className={o.won ? "text-pass" : "text-slate-300"}>{money(o.final)}</span>
                </span>
              </div>

              {/* opening price as the full bar, the conceded part shaded off the end */}
              <div className="mt-1.5 flex items-center gap-2">
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-edge">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${
                      o.won ? "bg-pass/70" : "bg-slate-600"
                    }`}
                    style={{ width: `${(o.final / maxPrice) * 100}%` }}
                  />
                  <div
                    className="absolute inset-y-0 rounded-r-full bg-slate-700/60"
                    style={{
                      left: `${(o.final / maxPrice) * 100}%`,
                      width: `${(moved / maxPrice) * 100}%`,
                    }}
                  />
                </div>
                <span className="tabular w-14 shrink-0 text-right font-mono text-[10px] text-slate-500">
                  {moved > 0 ? `−${movedPct.toFixed(1)}%` : "held"}
                </span>
              </div>

              {o.note && (
                <p className="mt-1 text-[12px] italic leading-snug text-muted">“{o.note}”</p>
              )}
            </li>
          );
        })}
      </ul>

      {winner && (
        <p className="border-t border-edge px-4 py-2.5 text-[12px] leading-relaxed text-slate-300">
          <span className="font-semibold text-pass">{winner.vendor}</span> won at{" "}
          <span className="tabular font-mono">{money(winner.final)}</span>/unit
          {poNumber && (
            <>
              {" "}
              → became{" "}
              <span className="font-mono text-slate-200">{poNumber}</span>
            </>
          )}
          {typeof totalCents === "number" && (
            <>
              , <span className="tabular font-mono">{money(totalCents)}</span> total
            </>
          )}
          .{" "}
          <span className="text-muted">
            That number is what the checks below verify — not what the seller said about it.
          </span>
        </p>
      )}
    </Panel>
  );
}
