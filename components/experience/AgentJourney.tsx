"use client";

import { useMemo, useState, type FormEvent } from "react";
import { getCatalog, type CatalogProduct } from "@/lib/catalog";
import type { Decision } from "@/lib/types";
import { money } from "@/lib/format";
import { generateReceipt } from "@/lib/receipt";
import { getAgent } from "@/lib/agents";
import { AgentAvatar } from "@/components/identity/AgentAvatar";
import { Avatar } from "@/components/identity/Avatar";
import { Badge, Button, Panel } from "@/components/ui";

type Phase = "idle" | "understanding" | "sourcing" | "checking" | "paid" | "stopped";

const SUGGESTIONS = [
  "I need two boxes of A4 paper. Find the best deal and handle it.",
  "Source GPU capacity for the training team.",
];

const WEEKLY_OBJECTIVE = "Keep office and engineering teams supplied through competitively sourced orders without exhausting any budget.";

/**
 * The customer-facing orchestration surface.
 *
 * It deliberately owns no payment rules. It gives a person one place to state an intent,
 * then renders the records the existing API returned: sellers, the accepted PO, checks,
 * card, and receipt. The console remains the forensic view; this is the experience of
 * having an agent work for you.
 */
export function AgentJourney({
  onDecision,
}: {
  onDecision?: (decision: Decision) => void;
}) {
  const catalog = useMemo(() => getCatalog(), []);
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("Hi — what would you like me to buy or keep stocked?");
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autonomous, setAutonomous] = useState(false);

  async function runProduct(nextProduct: CatalogProduct, quantity: number, autonomousRun: boolean) {
    setProduct(nextProduct);
    setDecision(null);
    setError(null);
    setAutonomous(autonomousRun);
    const agent = getAgent(nextProduct.agent);

    try {
      setPhase(nextProduct.kind === "negotiated" ? "sourcing" : "checking");
      setStatus(
        nextProduct.kind === "negotiated"
          ? `${agent.name} is inviting suppliers to compete for this order.`
          : `${agent.name} is validating the approved supplier order against your mandate.`
      );

      const response = await fetch(nextProduct.kind === "negotiated" ? "/api/purchase" : "/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          nextProduct.kind === "negotiated"
            ? {
                taskKey: nextProduct.taskKey,
                quantity,
                targetPriceCents: Math.round(nextProduct.fromCents * 0.93),
                costCentre: nextProduct.costCentre,
                validForDays: 3,
              }
            : {
                po: {
                  poNumber: nextProduct.poNumber,
                  vendor: nextProduct.vendor,
                  sku: nextProduct.sku,
                  unitPrice: nextProduct.fromCents,
                  quantity,
                  quoteExpiry: new Date(Date.now() + 3 * 864e5).toISOString(),
                  costCentre: nextProduct.costCentre,
                },
                agent: nextProduct.agent,
              }
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The agent could not complete this request.");

      const nextDecision = data.decision as Decision;
      setDecision(nextDecision);
      onDecision?.(nextDecision);
      setPhase("checking");
      setStatus("The winning order is now being checked against the exact mandate that governs it.");
      // The server has already made the decision; this beat lets the customer read the
      // evidence in its causal order rather than seeing a receipt appear from nowhere.
      await new Promise((resolve) => setTimeout(resolve, 650));
      const successful = nextDecision.outcome === "approved";
      setPhase(successful ? "paid" : "stopped");
      setStatus(
        successful
          ? "Done. The agent created a payment authority only for this verified order."
          : nextDecision.outcome === "held"
            ? "The agent stopped at its authority limit and escalated this order."
            : "The agent stopped the purchase because the order did not satisfy the mandate."
      );
    } catch (caught) {
      setError((caught as Error).message);
      setPhase("idle");
      setStatus("Nothing was issued. You can try another request.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || phase !== "idle") return;

    setError(null);
    setDecision(null);
    setProduct(null);
    setAutonomous(false);
    setPhase("understanding");
    setStatus("Mandate is reading your request and assigning the right specialist.");

    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "I could not match that to an available request.");
      const nextProduct = catalog.find((item) => item.id === data.productId);
      if (!nextProduct) throw new Error("That request is not available in this demo.");
      await runProduct(nextProduct, data.quantity as number, false);
    } catch (caught) {
      setError((caught as Error).message);
      setPhase("idle");
      setStatus("Nothing was issued. Try a suggested request below.");
    }
  }

  async function runWeeklyRoutine() {
    if (phase !== "idle") return;
    setError(null);
    setDecision(null);
    setProduct(null);
    setAutonomous(true);
    setPhase("understanding");
    setStatus("The standing mandate is active. The agent is choosing what needs attention first.");

    try {
      const response = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ objective: WEEKLY_OBJECTIVE, alreadyBought: [], sourceOnly: true }),
      });
      const data = await response.json();
      if (!response.ok || !data.productId) throw new Error(data.error ?? data.reasoning ?? "The agent found nothing to buy.");
      const nextProduct = catalog.find((item) => item.id === data.productId);
      if (!nextProduct) throw new Error("The agent selected an unavailable product.");
      setStatus(`The agent chose ${data.quantity} × ${nextProduct.name}: ${data.reasoning}`);
      await new Promise((resolve) => setTimeout(resolve, 450));
      await runProduct(nextProduct, data.quantity as number, true);
    } catch (caught) {
      setError((caught as Error).message);
      setPhase("idle");
      setStatus("Nothing was issued. Run the routine again to retry.");
    }
  }

  const busy = phase !== "idle" && phase !== "paid" && phase !== "stopped";
  const agent = product ? getAgent(product.agent) : null;
  const passed = decision?.checks.filter((check) => check.passed && !check.skipped).length ?? 0;
  const answered = decision?.checks.filter((check) => !check.skipped).length ?? 0;

  return (
    <section aria-label="Mandate agent journey" className="mx-auto max-w-5xl">
      <div className="text-center">
        <h2 className="mt-4 font-display text-[38px] font-medium leading-[1.05] tracking-[-0.03em] text-ink-900 sm:text-[50px]">
          Tell us what you need.<br />Mandate handles the rest.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
          Your purchasing agent finds suppliers, checks what is safe to spend, makes the
          payment, and sends you the receipt. You set the goal; Mandate does the chasing.
        </p>
        <div className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-2 text-left sm:grid-cols-4">
          {["Tell Mandate", "Compare suppliers", "Pay safely", "Get your receipt"].map((step, index) => (
            <div key={step} className="rounded-xl border border-edge bg-white px-3 py-2.5 text-[12px] text-ink-700 shadow-sm">
              <span className="mr-1.5 font-mono text-rain-600">{index + 1}.</span>{step}
            </div>
          ))}
        </div>
      </div>

      <Panel className="mt-8 overflow-hidden border-rain-200 shadow-[0_16px_50px_rgba(91,71,196,0.08)]">
        <div className="border-b border-edge bg-gradient-to-r from-rain-50 via-white to-white px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <AgentAvatar id="procurement-01" size={36} />
            <div>
              <p className="text-[14px] font-semibold text-ink-900">Mandate, your purchasing agent</p>
              <p className="text-[12.5px] text-muted">Tell me the outcome. I will take care of the order.</p>
            </div>
            {autonomous && <span className="ml-auto"><Badge tone="rain">handling this for you</Badge></span>}
          </div>
        </div>

        <div className="bg-ink-50/40 px-5 py-6 sm:px-7">
          <div className="flex max-w-3xl items-start gap-2.5 rounded-2xl rounded-tl-sm border border-rain-100 bg-rain-50/70 px-4 py-3 text-[14px] leading-relaxed text-ink-700">
            <AgentAvatar id={agent?.id ?? "procurement-01"} size={22} />
            <p>{status}</p>
          </div>

          {phase === "idle" && (
            <>
              <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="For example: I need two boxes of A4 paper. Find the best deal."
                  className="min-w-0 flex-1 rounded-xl border border-edge bg-white px-4 py-3 text-[14px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-rain-400 focus:ring-2 focus:ring-rain-100"
                />
                <Button type="submit" variant="primary" disabled={!message.trim()}>
                  Ask Mandate
                </Button>
              </form>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11.5px] text-ink-400">Try one:</span>
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setMessage(suggestion)}
                    className="rounded-full border border-edge bg-white px-3 py-1.5 text-[11.5px] text-ink-600 transition hover:border-rain-200 hover:text-rain-700"
                  >
                    {suggestion.replace(". Find the best deal and handle it.", "")}
                  </button>
                ))}
              </div>
              <div className="mt-5 border-t border-edge pt-4">
                <p className="text-[11.5px] font-medium uppercase tracking-wider text-ink-400">Or let Mandate decide</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rain-100 bg-rain-50/60 px-3.5 py-3">
                  <div className="max-w-xl text-[12.5px] leading-relaxed text-ink-700">
                    <p><strong>Give it a standing goal.</strong> Mandate chooses the next purchase itself, inside the limits you set.</p>
                    <p className="mt-1 text-muted">This week: keep office and engineering teams supplied without exhausting a budget.</p>
                  </div>
                  <Button variant="default" onClick={runWeeklyRoutine}>Take care of it</Button>
                </div>
              </div>
            </>
          )}

          {busy && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-rain-100 bg-white px-4 py-3 text-[13px] text-rain-700">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rain-500" />
              {phase === "understanding" ? "Understanding what you need" : phase === "sourcing" ? "Comparing supplier quotes" : "Making sure this order is safe"}
            </div>
          )}
          {error && <p className="mt-4 text-[13px] text-fail">{error}</p>}
        </div>

        {product && agent && (
          <div className="border-t border-edge px-5 py-4 sm:px-7">
            <div className="flex flex-wrap items-center gap-3">
              <AgentAvatar id={agent.id} size={28} />
              <p className="text-[13px] text-ink-700"><strong>{agent.name}</strong> is acting as {agent.role.toLowerCase()}.</p>
              <span className="ml-auto"><Badge tone="neutral">{product.costCentre}</Badge></span>
            </div>
          </div>
        )}

        {decision?.negotiation && (
          <div className="border-t border-edge px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-rain-600">1 · Supplier quotes</p>
                <p className="mt-1 text-[13px] text-muted">Mandate compared the options and chose the best qualifying offer.</p>
              </div>
              <Badge tone="rain">{decision.negotiation.offers.length} bids</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {decision.negotiation.offers.map((offer) => (
                <div key={offer.vendor} className={`rounded-xl border p-3.5 ${offer.won ? "border-mint-300 bg-mint-50" : "border-edge bg-white"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2"><Avatar name={offer.vendor} size={22} /><span className="truncate text-[13px] font-semibold text-ink-800">{offer.vendor}</span></span>
                    {offer.won ? <Badge tone="pass">selected</Badge> : <span className="text-[10.5px] font-mono uppercase tracking-wider text-ink-400">{offer.label}</span>}
                  </div>
                  <p className="mt-3 font-mono text-[13px]"><span className="text-ink-400 line-through">{money(offer.opening)}</span><span className="mx-1.5 text-ink-400">→</span><span className={offer.won ? "font-semibold text-mint-700" : "text-ink-800"}>{money(offer.final)}/unit</span></p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{offer.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {decision && (
          <div className="border-t border-edge px-5 py-5 sm:px-7">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-rain-600">{decision.negotiation ? "2" : "1"} · Safety check</p>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-edge bg-white p-4">
              <div>
                <p className="font-mono text-[13px] font-semibold text-ink-900">{decision.po.poNumber}</p>
                <p className="mt-1 text-[13px] text-ink-700">{decision.po.quantity} × {decision.po.sku} from {decision.po.vendor}</p>
                <p className="mt-1 text-[12px] text-muted">{passed} of {answered} policy checks passed · policy v{decision.ruleVersion}</p>
              </div>
              <p className="font-mono text-[16px] font-semibold text-ink-900">{money(decision.po.unitPrice * decision.po.quantity)}</p>
            </div>
            <details className="group mt-3 rounded-xl border border-edge bg-ink-50/50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-[12.5px] text-ink-700 marker:hidden">
                <span><strong>{passed} checks passed.</strong> See why this order is safe.</span>
                <span className="font-mono text-[11px] text-rain-600 group-open:hidden">show checks +</span>
                <span className="hidden font-mono text-[11px] text-rain-600 group-open:inline">hide checks −</span>
              </summary>
              <div className="grid gap-2 border-t border-edge px-3.5 py-3 sm:grid-cols-2">
                {decision.checks.filter((check) => !check.skipped).map((check) => (
                  <div key={check.ruleId} className={`rounded-lg px-3 py-2 text-[11.5px] ${check.passed ? "bg-mint-50 text-mint-800" : "bg-red-50 text-fail"}`}>
                    <strong>{check.passed ? "Passed" : "Stopped"}</strong> · {check.label}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {decision && (phase === "paid" || phase === "stopped") && (
          <div className="border-t border-edge bg-ink-50/40 px-5 py-5 sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-rain-600">{decision.negotiation ? "3" : "2"} · Your order</p>
                <p className="mt-1 text-[15px] font-semibold text-ink-900">
                  {decision.outcome === "approved" ? "Payment is ready for this order" : decision.outcome === "held" ? "This order needs someone with more authority" : "This order was stopped before payment"}
                </p>
                {decision.card && <p className="mt-1 text-[12.5px] text-mint-700">Rain card ••••{decision.card.last4} · capped at {money(decision.card.limitCents)}</p>}
                {decision.card?.rainSettlement && <p className="mt-1 font-mono text-[11.5px] text-mint-700">Rain sandbox settled · {decision.card.rainSettlement.transactionId}</p>}
              </div>
              <Button variant="default" onClick={() => generateReceipt(decision)}>Download purchase receipt</Button>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">Your receipt is saved with the order. Open the evidence section only if you want to inspect the details.</p>
          </div>
        )}
      </Panel>
      <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[11.5px] text-ink-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rain-500" />Real Rain card payments</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-monad-500" />Policy anchored on Monad</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-mint-500" />Orders saved in Postgres</span>
      </div>
    </section>
  );
}
