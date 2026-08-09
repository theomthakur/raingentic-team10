import Link from "next/link";
import { Badge, Panel } from "@/components/ui";
import { SystemDiagram } from "@/components/explain/SystemDiagram";
import { TechStack } from "@/components/explain/TechStack";
import { ControlCoverage } from "@/components/explain/ControlCoverage";
import { PaymentRailPanel } from "@/components/explain/PaymentRailPanel";
import { ArchitectureMap } from "@/components/explain/ArchitectureMap";
import { Footer } from "@/components/layout/Footer";
import { SubPageHeader } from "@/components/layout/SiteNav";

export const metadata = { title: "Mandate — proof" };

const FLOW = [
  { n: "01", title: "Goal → specialist", text: "Mandate uses the intake API to route a goal to the buyer responsible for that category." },
  { n: "02", title: "Quote → exact PO", text: "The specialist compares modeled suppliers, then declares one vendor, SKU, quantity, and price." },
  { n: "03", title: "Policy → Monad proof", text: "Eleven deterministic checks pass first; Mandate then verifies the active rule hash and receipt on Monad testnet." },
  { n: "04", title: "Rain API → record", text: "Only then does Rain issue a scoped sandbox card. The outcome, receipt, and policy version are saved to Postgres." },
];

/**
 * Proof is deliberately a landing page, not the project documentation. A judge should
 * grasp the product and the sponsor integrations in one screen; implementation detail is
 * retained behind one optional disclosure for the person who wants to inspect it.
 */
export default function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-white">
      <SubPageHeader current="/architecture" />

      <main className="mx-auto max-w-[1100px] px-6 py-10 md:px-10">
        <section className="mx-auto max-w-3xl text-center">
          <Badge tone="rain">How Mandate works</Badge>
          <h1 className="mt-4 font-display text-[36px] font-medium leading-[1.08] tracking-[-0.035em] text-ink-900 md:text-[50px]">
            An agent can buy. Mandate makes sure it should.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
            Mandate is the control layer between an autonomous purchasing agent and company money.
            It turns a goal into a verified order - then spends only inside the limits you set.
          </p>
        </section>

        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-400">The architecture, in one screen</p>
            <Link href="/" className="text-[12.5px] font-medium text-rain-600 hover:text-rain-700">Try it live →</Link>
          </div>
          <ArchitectureMap />
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-3" aria-label="Live integration summary">
          <Panel className="border-rain-200 bg-rain-50/50 p-4">
            <Badge tone="rain">Rain API</Badge>
            <h2 className="mt-2 text-[15px] font-semibold text-ink-900">Programmable payment authority</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-700">Mandate calls Rain&apos;s scoped-card endpoint only after approval, then reads the card back and records the sandbox transaction lifecycle.</p>
            <p className="mt-3 font-mono text-[10px] text-rain-700">POST /issuing/users/&#123;userId&#125;/cards/scoped</p>
          </Panel>
          <Panel className="border-monad-200 bg-monad-50/50 p-4">
            <Badge tone="monad">Monad RPC</Badge>
            <h2 className="mt-2 text-[15px] font-semibold text-ink-900">Policy proof before spend</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-700">Each policy version is committed on Monad testnet. Mandate checks the exact transaction payload and receipt before it unlocks Rain issuance.</p>
            <p className="mt-3 font-mono text-[10px] text-monad-700">eth_getTransaction + receipt check</p>
          </Panel>
          <Panel className="border-mint-200 bg-mint-50/50 p-4">
            <Badge tone="pass">Postgres</Badge>
            <h2 className="mt-2 text-[15px] font-semibold text-ink-900">Replayable decision evidence</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-700">The purchase order, rule version, check evidence, Rain card reference, and outcome share one append-only decision log.</p>
            <p className="mt-3 font-mono text-[10px] text-mint-700">decision + policy snapshot</p>
          </Panel>
        </section>

        <section className="mt-8">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">The flow in 30 seconds</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FLOW.map((step) => (
              <Panel key={step.n} className="p-4">
                <p className="font-mono text-[11px] text-rain-600">{step.n}</p>
                <h2 className="mt-2 text-[15px] font-semibold text-ink-900">{step.title}</h2>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{step.text}</p>
              </Panel>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-rain-100 bg-rain-50/50 px-5 py-5 sm:px-6">
          <p className="text-[13px] font-semibold text-ink-900">The one-line thesis</p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink-700">
            Any agent can find something to buy. Mandate binds its chosen purchase to an exact PO, checks it before money moves, and leaves proof of why it was allowed.
          </p>
        </section>

        <details className="group mt-10 rounded-2xl border border-edge bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[13.5px] font-semibold text-ink-800 marker:hidden">
            Technical evidence and implementation detail
            <span className="font-mono text-[12px] text-rain-600 group-open:hidden">open +</span>
            <span className="hidden font-mono text-[12px] text-rain-600 group-open:inline">close −</span>
          </summary>
          <div className="space-y-8 border-t border-edge px-5 py-6">
            <section>
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">Control coverage</p>
              <ControlCoverage />
            </section>
            <section>
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">Programmable money rail</p>
              <PaymentRailPanel />
            </section>
            <section>
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">Execution detail</p>
              <SystemDiagram />
            </section>
            <section>
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">Stack</p>
              <TechStack />
            </section>
          </div>
        </details>
      </main>

      <Footer />
    </div>
  );
}
