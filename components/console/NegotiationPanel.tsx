"use client";

import { useState } from "react";
import type { NegotiationSummary } from "@/lib/types";
import { money } from "@/lib/format";
import { Avatar } from "../identity/Avatar";
import { Badge, Button, Panel } from "../ui";

/**
 * The transcript below is a replay, not a live chat. Every number and every note in it was
 * already decided by `negotiate()` before this component ever rendered, no model runs
 * here, nothing is generated on click. It exists because reading five price bars doesn't
 * feel like watching a negotiation happen, and a chat-shaped read of the exact same,
 * already-final numbers does. Presentation, not a new decision surface.
 */
function Transcript({ negotiation }: { negotiation: NegotiationSummary }) {
  const { offers, buyerTargetCents } = negotiation;
  // Conversation order: whoever the buyer's target implicitly challenged first, read left
  // to right the same way the bars above do, opening price ascending.
  const ordered = [...offers].sort((a, b) => a.opening - b.opening);

  return (
    <div className="space-y-3 border-t border-edge bg-ink-50/40 px-4 py-4">
      <div className="flex justify-start">
        <div className="flex max-w-[85%] items-start gap-2">
          <Avatar name="Buyer" color="#121212" size={24} />
          <div className="rounded-2xl rounded-tl-sm bg-ink-900 px-3 py-2 text-[12.5px] text-white">
            Opening at {money(buyerTargetCents)}/unit: who can meet that?
          </div>
        </div>
      </div>

      {ordered.map((o) => (
        <div key={o.vendor} className="flex justify-end">
          <div className="flex max-w-[85%] flex-row-reverse items-start gap-2">
            <Avatar name={o.vendor} size={24} />
            <div
              className={`rounded-2xl rounded-tr-sm px-3 py-2 text-[12.5px] ${
                o.won ? "bg-mint-50 text-mint-800 ring-1 ring-mint-200" : "bg-white text-ink-800 ring-1 ring-edge"
              }`}
            >
              <p className="font-semibold">{o.vendor}</p>
              <p className="mt-0.5">{o.note}</p>
              <p className="tabular mt-1 font-mono text-[11px] opacity-70">
                final {money(o.final)}/unit{o.won ? ", won" : ""}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

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
 * beside the verification: it produces the thing being verified.
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
  const [showTranscript, setShowTranscript] = useState(false);

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
          <Button variant="ghost" onClick={() => setShowTranscript((v) => !v)}>
            {showTranscript ? "Hide transcript" : "Show transcript"}
          </Button>
        </div>
      }
    >
      <p className="border-b border-edge px-4 py-2.5 text-[12px] text-muted">
        Buyer opened at{" "}
        <span className="tabular font-mono text-ink-700">{money(buyerTargetCents)}</span>{" "}
        per unit. Sellers concede by their own strategy, and none goes below its floor.
      </p>

      <ul className="divide-y divide-edge">
        {offers.map((o) => {
          const moved = o.opening - o.final;
          const movedPct = o.opening === 0 ? 0 : (moved / o.opening) * 100;
          return (
            <li key={o.vendor} className={`px-4 py-2.5 ${o.won ? "bg-mint-50/60" : ""}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar name={o.vendor} size={20} />
                  <span
                    className={`truncate text-[13px] ${
                      o.won ? "font-semibold text-mint-700" : "text-ink-700"
                    }`}
                  >
                    {o.vendor}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-400">
                    {o.label}
                  </span>
                </span>
                <span className="tabular shrink-0 font-mono text-[12px]">
                  <span className="text-ink-400 line-through">{money(o.opening)}</span>
                  <span className="mx-1.5 text-ink-400">→</span>
                  <span className={o.won ? "text-mint-700" : "text-ink-700"}>{money(o.final)}</span>
                </span>
              </div>

              {/* opening price as the full bar, the conceded part shaded off the end */}
              <div className="mt-1.5 flex items-center gap-2">
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${
                      o.won ? "bg-mint-500" : "bg-ink-300"
                    }`}
                    style={{ width: `${(o.final / maxPrice) * 100}%` }}
                  />
                  <div
                    className="absolute inset-y-0 rounded-r-full bg-ink-200"
                    style={{
                      left: `${(o.final / maxPrice) * 100}%`,
                      width: `${(moved / maxPrice) * 100}%`,
                    }}
                  />
                </div>
                <span className="tabular w-14 shrink-0 text-right font-mono text-[10px] text-ink-500">
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

      {showTranscript && <Transcript negotiation={negotiation} />}

      {winner && (
        <p className="border-t border-edge px-4 py-2.5 text-[12px] leading-relaxed text-ink-700">
          <span className="font-semibold text-mint-700">{winner.vendor}</span> won at{" "}
          <span className="tabular font-mono">{money(winner.final)}</span>/unit
          {poNumber && (
            <>
              {" "}
              → became{" "}
              <span className="font-mono text-ink-900">{poNumber}</span>
            </>
          )}
          {typeof totalCents === "number" && (
            <>
              , <span className="tabular font-mono">{money(totalCents)}</span> total
            </>
          )}
          .{" "}
          <span className="text-muted">
            That number is what the checks below verify, not what the seller said about it.
          </span>
        </p>
      )}
    </Panel>
  );
}
