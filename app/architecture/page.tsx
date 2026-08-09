import Link from "next/link";
import { Badge, Panel } from "@/components/ui";
import { SystemDiagram } from "@/components/explain/SystemDiagram";
import { TechStack } from "@/components/explain/TechStack";
import { ControlCoverage } from "@/components/explain/ControlCoverage";
import { PaymentRailPanel } from "@/components/explain/PaymentRailPanel";
import { Footer } from "@/components/layout/Footer";
import { SubPageHeader } from "@/components/layout/SiteNav";

export const metadata = { title: "Mandate — proof" };

const FLOW = [
  { n: "01", title: "Set a goal", text: "A customer asks Mandate to keep a team supplied or source a specific item." },
  { n: "02", title: "Agents compete", text: "A specialist sources the request and compares the modeled supplier offers." },
  { n: "03", title: "Mandate verifies", text: "Eleven deterministic checks compare the exact PO with budget, authority, and records." },
  { n: "04", title: "Spend or stop", text: "A scoped Rain sandbox card is issued only for an approved PO. Large or wrong orders stop." },
];

const INTEGRATIONS = [
  {
    name: "Rain",
    tone: "rain" as const,
    feature: "Scoped virtual cards + sandbox settlement",
    text: "After Mandate approves a purchase order, Rain issues a card capped to that order. The sandbox flow authorizes and settles it.",
  },
  {
    name: "Monad",
    tone: "monad" as const,
    feature: "Policy-version anchor on testnet",
    text: "Mandate hashes each active policy version and writes that hash in a real Monad testnet transaction, so policy cannot be quietly backdated.",
  },
  {
    name: "Postgres",
    tone: "pass" as const,
    feature: "Append-only order and decision log",
    text: "Every proposal, check, hold, card outcome, and receipt is saved as evidence the customer can inspect later.",
  },
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
            <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-400">The flow in 30 seconds</p>
            <Link href="/" className="text-[12.5px] font-medium text-rain-600 hover:text-rain-700">Try it live →</Link>
          </div>
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

        <section className="mt-10">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">What is integrated, exactly</p>
          <div className="grid gap-3 md:grid-cols-3">
            {INTEGRATIONS.map((integration) => (
              <Panel key={integration.name} className="p-5">
                <Badge tone={integration.tone}>{integration.name}</Badge>
                <h2 className="mt-3 text-[15px] font-semibold text-ink-900">{integration.feature}</h2>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{integration.text}</p>
              </Panel>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            Supplier profiles are modeled for the demo. Rain and Monad integrations run against their respective sandboxes/testnet; no real funds move.
          </p>
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
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-400">System diagram</p>
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
