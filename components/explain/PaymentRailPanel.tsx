"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Panel } from "@/components/ui";

type RailState = {
  configured: boolean;
  environment: string;
  kind: string;
  reason?: string;
};

type Simulation = {
  configured: true;
  environment: "rain-sandbox";
  kind: string;
  note: string;
  route: {
    id: string;
    status: string | null;
    source: { currency?: string; rail?: string } | null;
    destination: { currency?: string; rail?: string } | null;
  };
  transfer: {
    simulationId: string | null;
    flow: string | null;
    status: string;
    amountUsd: string;
  };
};

function railLabel(rail: { currency?: string; rail?: string } | null): string {
  if (!rail) return "Rain-configured rail";
  return [rail.currency?.toUpperCase(), rail.rail?.toUpperCase()].filter(Boolean).join(" · ");
}

/**
 * A deliberately small control for the independent treasury rail.
 *
 * Supplier checkout uses an exact-PO scoped card. This is a different Rain sandbox
 * capability: a configured fiat-to-crypto route. Keeping it here, in Proof, makes that
 * distinction visible rather than silently bundling it into the customer purchase story.
 */
export function PaymentRailPanel() {
  const [state, setState] = useState<RailState | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rails/simulate", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as RailState;
        setState(data);
      })
      .catch(() => setError("Could not read the Rain payment-rail configuration."));
  }, []);

  async function simulate() {
    setBusy(true);
    setError(null);
    setSimulation(null);
    try {
      const response = await fetch("/api/rails/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountUsd: "25.00", reference: `mandate-proof-${Date.now()}` }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? data.reason ?? "Rain did not accept the simulation.");
      setSimulation(data as Simulation);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ready = state?.configured === true;

  return (
    <Panel
      title="A second Rail: treasury movement"
      right={<Badge tone={ready ? "rain" : "neutral"}>{ready ? "Rain sandbox ready" : "not configured"}</Badge>}
    >
      <div className="px-5 py-4">
        <p className="max-w-3xl text-[13.5px] leading-relaxed text-ink-700">
          Supplier checkout issues a scoped card for one verified purchase order. This is
          separate: a configured Rain payment route moves value from a fiat rail to an
          on-chain rail. It is a sandbox simulation, never a supplier payment and never
          real money.
        </p>

        {!ready && state && (
          <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-[12.5px] text-muted">
            {state.reason ?? "A Rain payment route has not been configured."}
          </p>
        )}

        {ready && !simulation && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rain-100 bg-rain-50/60 px-3.5 py-3">
            <div>
              <p className="text-[13px] font-medium text-ink-900">Test the configured route with $25.00</p>
              <p className="mt-0.5 text-[12px] text-muted">Rain will accept a sandbox transfer simulation; no funds move.</p>
            </div>
            <Button variant="default" onClick={simulate} disabled={busy}>
              {busy ? "Contacting Rain…" : "Simulate route"}
            </Button>
          </div>
        )}

        {simulation && (
          <div className="mt-4 rounded-xl border border-mint-200 bg-mint-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13.5px] font-semibold text-mint-800">Rain accepted the sandbox simulation</p>
              <Badge tone="pass">{simulation.transfer.status}</Badge>
            </div>
            <div className="mt-3 grid gap-2 text-[12.5px] text-ink-700 sm:grid-cols-3">
              <p><span className="block text-[10.5px] uppercase tracking-wider text-ink-400">Source</span>{railLabel(simulation.route.source)}</p>
              <p><span className="block text-[10.5px] uppercase tracking-wider text-ink-400">Destination</span>{railLabel(simulation.route.destination)}</p>
              <p><span className="block text-[10.5px] uppercase tracking-wider text-ink-400">Amount</span>${simulation.transfer.amountUsd}</p>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Accepted means Rain received the sandbox request; it does not mean a transfer settled.
              {simulation.transfer.simulationId ? ` Tracking ID: ${simulation.transfer.simulationId}.` : " Rain returned no tracking ID for this asynchronous response."}
            </p>
          </div>
        )}

        {error && <p className="mt-3 text-[12.5px] text-fail">{error}</p>}
      </div>
    </Panel>
  );
}
