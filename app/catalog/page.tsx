"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getCatalog, type CatalogProduct } from "@/lib/catalog";
import type { Decision } from "@/lib/types";
import type { Stage } from "@/lib/pipeline";
import { money } from "@/lib/format";
import { Avatar } from "@/components/identity/Avatar";
import { getAgent } from "@/lib/agents";
import { Badge, Button, Panel } from "@/components/ui";
import { TaskLoop, type LoopState } from "@/components/console/TaskLoop";
import { Autopilot } from "@/components/console/Autopilot";
import { Footer } from "@/components/layout/Footer";
import { SubPageHeader } from "@/components/layout/SiteNav";

/**
 * The buying side, as a person would actually meet it.
 *
 * Every button here posts to the same two endpoints the console already uses. There is no
 * catalogue-only code path and no shortcut past the checks — a purchase made from this
 * page is indistinguishable, downstream, from one an agent made on its own.
 */

/** A beat between steps. A loop that finishes in 40ms communicates nothing. */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RunResult {
  decision: Decision;
  stages: Stage[];
}


function Stepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const btn =
    "flex h-7 w-7 items-center justify-center rounded-lg border border-edge bg-white text-[15px] leading-none text-ink-600 transition hover:border-ink-300 hover:bg-ink-50 disabled:opacity-40";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} disabled={disabled || value <= 1} onClick={() => onChange(value - 1)}>
        −
      </button>
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="tabular w-14 rounded-lg border border-edge bg-white px-2 py-1 text-center font-mono text-[12.5px] text-ink-900 outline-none focus:border-rain-400 focus:ring-2 focus:ring-rain-100"
      />
      <button type="button" className={btn} disabled={disabled} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

function ProductCard({
  product,
  qty,
  setQty,
  onBuy,
  busy,
  selected = false,
}: {
  product: CatalogProduct;
  qty: number;
  setQty: (n: number) => void;
  onBuy: () => void;
  busy: boolean;
  selected?: boolean;
}) {
  const estimate = product.fromCents * qty;
  const agent = getAgent(product.agent);
  const offQuote =
    product.kind === "contract" && product.quotedQuantity != null && qty !== product.quotedQuantity;

  return (
    <Panel className={`flex h-full flex-col transition ${selected ? "ring-2 ring-rain-400 ring-offset-2" : ""}`}>
      <div className="relative aspect-[16/9] overflow-hidden rounded-t-2xl bg-ink-50">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 360px, 100vw"
          className="object-cover"
        />
        <div className="absolute left-4 top-4">
          <Badge tone={product.kind === "negotiated" ? "rain" : "neutral"}>
            {product.kind === "negotiated" ? "agent sources this" : "approved supplier"}
          </Badge>
        </div>
      </div>
      <div className="flex flex-1 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14.5px] font-semibold leading-snug text-ink-900">{product.name}</p>
          </div>

          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{product.blurb}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-500">
            {product.kind === "negotiated" ? (
              <span className="tabular font-mono">
                from {money(product.fromCents)}/{product.unit}
              </span>
            ) : (
              <span className="tabular font-mono">
                {money(product.fromCents)}/{product.unit}
              </span>
            )}
            <span className="text-ink-300">·</span>
            <span className="font-mono">{product.costCentre}</span>
            {product.sellerCount && (
              <>
                <span className="text-ink-300">·</span>
                <span>{product.sellerCount} sellers bidding</span>
              </>
            )}
            {product.vendor && (
              <>
                <span className="text-ink-300">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Avatar name={product.vendor} size={16} />
                  {product.vendor}
                </span>
              </>
            )}
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-500">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: agent.color }} />
            Delegated to <span className="font-medium text-ink-700">{agent.name}</span>, {agent.role.toLowerCase()}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600">“{agent.assurance}”</p>

          {product.alreadyFulfilled && (
            <p className="mt-2 text-[12px] text-warn">
              This line is already fulfilled — buying it is the duplicate-spend demo.
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-edge px-5 py-3.5">
        <div>
          <Stepper value={qty} onChange={setQty} disabled={busy} />
          {product.kind === "contract" && product.quotedQuantity != null && (
            <p className={`mt-1 text-[11px] ${offQuote ? "text-warn" : "text-ink-400"}`}>
              {offQuote
                ? `quote is for ${product.quotedQuantity} — the amount check will refuse this`
                : `matches the quoted ${product.quotedQuantity}`}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="tabular font-mono text-[14px] font-semibold text-ink-900">
            {money(estimate)}
          </p>
          <p className="text-[10.5px] text-ink-400">
            {product.kind === "negotiated" ? "before negotiation" : "declared total"}
          </p>
        </div>
      </div>

      <div className="border-t border-edge px-5 py-3">
        <Button variant="primary" onClick={onBuy} disabled={busy}>
          {busy
            ? "Agent is working…"
            : product.kind === "negotiated"
              ? "Have agent source this"
              : "Have agent purchase this"}
        </Button>
      </div>
    </Panel>
  );
}

function ResultPanel({ result, error }: { result: RunResult | null; error: string | null }) {
  if (error) {
    return (
      <Panel title="Result">
        <p className="px-5 py-4 text-[13px] text-fail">{error}</p>
      </Panel>
    );
  }
  if (!result) {
    return (
      <Panel title="Result">
        <p className="px-5 py-4 text-[13px] text-muted">
          Choose an item and delegate it to the relevant agent. It will source a quote when
          needed, verify the exact order against the mandate, then create a card only if
          the record supports it.
        </p>
      </Panel>
    );
  }

  const { decision, stages } = result;
  const tone =
    decision.outcome === "approved" ? "pass" : decision.outcome === "held" ? "warn" : "fail";
  const failure = decision.checks.find((c) => !c.passed && !c.skipped);

  return (
    <Panel
      title="Result"
      right={<Badge tone={tone}>{decision.outcome.toUpperCase()}</Badge>}
    >
      <div className="border-b border-edge px-5 py-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[13px] text-ink-900">{decision.po.poNumber}</p>
          <p className="tabular font-mono text-[13px] text-ink-900">
            {money(decision.po.unitPrice * decision.po.quantity)}
          </p>
        </div>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {decision.po.quantity} × {decision.po.sku} from {decision.po.vendor}
        </p>
        {failure && <p className="mt-2 text-[12.5px] leading-relaxed text-fail">{failure.reason}</p>}
        {decision.card && (
          <p className="mt-2 font-mono text-[11.5px] text-mint-700">
            card ••••{decision.card.last4} · limit {money(decision.card.limitCents)}
          </p>
        )}
      </div>

      <ol className="divide-y divide-edge">
        {stages.map((s) => (
          <li key={`${s.name}-${s.detail}`} className="flex items-start gap-2.5 px-5 py-2.5">
            <span
              className={`mt-px w-[5.5rem] shrink-0 rounded-full px-2 py-0.5 text-center font-mono text-[10px] font-semibold ${
                s.ok ? "bg-mint-100 text-mint-700" : "bg-red-100 text-fail"
              }`}
            >
              {s.name}
            </span>
            <span className="text-[12.5px] leading-snug text-ink-600">{s.detail}</span>
          </li>
        ))}
      </ol>

      <p className="border-t border-edge px-5 py-3 text-[12px] text-muted">
        Recorded in the log.{" "}
        <Link href="/" className="text-rain-600 underline-offset-2 hover:underline">
          Open the full audit trail →
        </Link>
      </p>
    </Panel>
  );
}

function RequestChat({
  catalog,
  busy,
  loop,
  onDelegate,
}: {
  catalog: CatalogProduct[];
  busy: boolean;
  loop: LoopState | null;
  /** Runs the whole thing. There is no confirm step — delegating is the product. */
  onDelegate: (product: CatalogProduct, quantity: number, understood: string) => void;
}) {
  const [request, setRequest] = useState("");
  const [match, setMatch] = useState<{ product: CatalogProduct; quantity: number } | null>(null);
  const [thinking, setThinking] = useState(false);
  // Which path read the request. Shown on screen, because implying a model ran when it
  // did not is the exact overclaim this project argues against.
  const [via, setVia] = useState<"model" | "keywords" | null>(null);
  const [reply, setReply] = useState(
    "Tell me what you need. I’ll route it to the right purchasing agent and keep the work inside your mandate."
  );

  /**
   * Read the request, then route it.
   *
   * The reading is the one place a model is allowed to interpret: /api/intake turns a
   * sentence into { productId, quantity } and nothing more. Whether the purchase is
   * *allowed* is still decided downstream by the same eleven deterministic checks, so a
   * misreading produces a wrong request that gets judged exactly as harshly as any other,
   * never a wrong decision.
   */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!request.trim() || thinking) return;

    setThinking(true);
    setMatch(null);
    setReply("Reading that…");

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: request }),
      });
      const data = await res.json();

      if (!res.ok) {
        setReply(data.error ?? "I could not match that to anything in the catalogue.");
        return;
      }

      const product = catalog.find((item) => item.id === data.productId);
      if (!product) {
        setReply("I could not match that to anything in the catalogue.");
        return;
      }

      const quantity = data.quantity as number;
      const agent = getAgent(product.agent);
      setMatch({ product, quantity });
      setVia(data.via === "model" ? "model" : "keywords");
      setReply(`On it — ${data.understood}. ${agent.name} is handling this. ${agent.assurance}`);
      // No confirm step. Being asked to press "start with Rae" would make the person do
      // the routing the product exists to do for them.
      onDelegate(product, quantity, data.understood as string);
    } catch {
      setReply("I could not reach the intake service. Try one of the cards below.");
    } finally {
      setThinking(false);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-rain-200 bg-rain-50/40 shadow-sm shadow-rain-900/[0.03]">
      <div className="border-b border-rain-100 bg-white/80 px-5 py-3.5">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-rain-600">Ask your purchasing agent</p>
        <p className="mt-1 text-[12.5px] text-muted">Example: “I need two boxes of A4 paper. Find the best deal and handle it.”</p>
      </div>
      <div className="space-y-3 px-5 py-4">
        <p className="max-w-2xl rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-[13px] leading-relaxed text-ink-700 shadow-sm shadow-ink-900/[0.03]">{reply}</p>
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            placeholder="What do you need?"
            className="min-w-0 flex-1 rounded-xl border border-edge bg-white px-3.5 py-2.5 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-rain-400 focus:ring-2 focus:ring-rain-100"
          />
          <Button type="submit" variant="primary" disabled={!request.trim() || busy || thinking}>
            {thinking ? "Reading…" : "Find my agent"}
          </Button>
        </form>

        {/* Say which path read the request. A keyword fallback dressed up as a model is
            precisely the kind of quiet overclaim this whole product argues against. */}
        {via && (
          <p className="text-[11.5px] text-ink-400">
            {via === "model"
              ? "Read by the model, then handed to the deterministic checks."
              : "Model unavailable — read by keyword matching, then handed to the same checks."}
          </p>
        )}
        {loop && (
          <div className="rounded-xl border border-rain-200 bg-white px-4 py-4">
            {match && (
              <p className="mb-3 text-[12.5px] text-ink-700">
                <strong>{match.quantity} × {match.product.name}</strong>
              </p>
            )}
            <TaskLoop state={loop} />
          </div>
        )}
      </div>
    </section>
  );
}

export default function CatalogPage() {
  const catalog = useMemo(() => getCatalog(), []);
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(catalog.map((p) => [p.id, p.quotedQuantity ?? 10]))
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [loop, setLoop] = useState<LoopState | null>(null);

  /**
   * Read → route → run, with the loop reflecting real progress.
   *
   * The steps are not on a timer. `understand` and `assign` are already true by the time
   * this is called; the rest are marked from the stages the pipeline returns, so the
   * animation is a readout of work that happened rather than a performance of it. The one
   * concession to pacing is a short beat between steps, because a loop that completes in
   * 40ms communicates nothing.
   */
  async function delegate(product: CatalogProduct, quantity: number, understood: string) {
    setQty((current) => ({ ...current, [product.id]: quantity }));
    setSelectedProductId(product.id);
    setResult(null);
    setError(null);

    const detail: LoopState["detail"] = { understand: understood };
    setLoop({ done: ["understand"], active: "assign", agentId: product.agent, detail });
    await sleep(420);

    setLoop({
      done: ["understand", "assign"],
      active: product.kind === "negotiated" ? "negotiate" : "verify",
      agentId: product.agent,
      detail,
    });

    const decision = await buy(product, quantity);
    if (!decision) {
      setLoop(null);
      return;
    }

    const stageNames = new Set(decision.stages.map((s) => s.name));
    const negotiated = decision.stages.find((s) => s.name === "NEGOTIATE");
    if (negotiated) detail.negotiate = negotiated.detail;

    if (product.kind === "negotiated") {
      setLoop({ done: ["understand", "assign", "negotiate"], active: "verify", agentId: product.agent, detail });
      await sleep(420);
    }

    const verify = decision.stages.find((s) => s.name === "VERIFY");
    if (verify) detail.verify = verify.detail;
    const outcome = decision.decision.outcome;

    setLoop({
      done: ["understand", "assign", ...(product.kind === "negotiated" ? (["negotiate"] as const) : []), "verify"],
      active: "settle",
      agentId: product.agent,
      detail,
    });
    await sleep(420);

    const closing =
      decision.stages.find((s) => s.name === "REVOKE") ??
      decision.stages.find((s) => s.name === "REFUSE") ??
      decision.stages.find((s) => s.name === "HOLD");
    if (closing) detail.settle = closing.detail;
    else if (stageNames.has("SETTLE")) detail.settle = "Settled and recorded.";

    setLoop({
      done: ["understand", "assign", ...(product.kind === "negotiated" ? (["negotiate"] as const) : []), "verify", "settle"],
      active: null,
      outcome,
      agentId: product.agent,
      detail,
    });
  }

  async function buy(
    product: CatalogProduct,
    quantityOverride?: number
  ): Promise<RunResult | null> {
    setBusyId(product.id);
    setError(null);
    setResult(null);
    // setQty in the same tick has not flushed yet, so delegate passes the value directly.
    const quantity = quantityOverride ?? qty[product.id];

    try {
      const url = product.kind === "negotiated" ? "/api/purchase" : "/api/run";
      const body =
        product.kind === "negotiated"
          ? {
              taskKey: product.taskKey,
              quantity,
              // Open the counter-offer round a little under the cheapest list price —
              // the same posture the canned demo tasks take.
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
                quantity,
                quoteExpiry: new Date(Date.now() + 3 * 864e5).toISOString(),
                costCentre: product.costCentre,
              },
              agent: product.agent,
            };

      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      const run: RunResult = { decision: data.decision, stages: data.stages };
      setResult(run);
      return run;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setBusyId(null);
    }
  }

  const negotiated = catalog.filter((p) => p.kind === "negotiated");
  const contract = catalog.filter((p) => p.kind === "contract");

  return (
    <div className="min-h-screen bg-white">
      <SubPageHeader current="/catalog" />

      <main className="mx-auto max-w-[1600px] px-6 py-10 md:px-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section>
            <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-400">
              Agent sourcing desk
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-[32px] font-medium leading-tight tracking-[-0.02em] text-ink-900">
              Tell us what you need. Your purchasing agent takes it from there.
            </h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-muted">
              Choose an item and quantity. Mandate routes it to the agent for that category;
              the agent either sources competing offers or buys from an approved supplier,
              and controls verify every dollar before a card can exist.
            </p>
            <RequestChat
              catalog={catalog}
              busy={busyId !== null}
              loop={loop}
              onDelegate={delegate}
            />

            <div className="mt-6">
              <Autopilot
                catalog={catalog}
                onResult={(next) => {
                  setError(null);
                  setResult(next);
                }}
              />
            </div>
          </section>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <ResultPanel result={result} error={error} />
          </aside>
        </div>

        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-400">
                Available requests
              </p>
              <p className="mt-1 text-[12.5px] text-muted">
                {negotiated.length} categories source competitively · {contract.length} use approved supplier records
              </p>
            </div>
            <p className="font-mono text-[12px] text-ink-400">{catalog.length} items</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {catalog.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                qty={qty[p.id]}
                setQty={(n) => setQty((q) => ({ ...q, [p.id]: n }))}
                onBuy={() => buy(p)}
                busy={busyId === p.id}
                selected={selectedProductId === p.id}
              />
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
