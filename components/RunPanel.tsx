"use client";

import { useState } from "react";
import type { Task } from "@/lib/fixtures/tasks";
import type { PurchaseOrder } from "@/lib/types";
import type { Stage } from "@/lib/pipeline";
import { Badge, Button, Panel } from "./ui";

const STAGE_ORDER: Stage["name"][] = ["PROPOSE", "VERIFY", "REFUSE", "ISSUE", "SETTLE", "RECORD"];

function StageTrace({ stages }: { stages: Stage[] }) {
  return (
    <ol className="space-y-2">
      {stages.map((s, i) => {
        const n = STAGE_ORDER.indexOf(s.name) + 1;
        return (
          <li
            key={`${s.name}-${s.detail}`}
            className="flex animate-row-in items-start gap-2.5 text-[12.5px]"
            style={{ animationDelay: `${i * 70}ms`, animationFillMode: "backwards" }}
          >
            <span
              className={`mt-px w-16 shrink-0 rounded-full px-2 py-0.5 text-center font-mono text-[10px] font-semibold ${
                s.ok ? "bg-mint-100 text-mint-700" : "bg-red-100 text-fail"
              }`}
            >
              {n} {s.name}
            </span>
            <span className={s.ok ? "text-ink-600" : "text-ink-900"}>{s.detail}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** The judge-editable form. Same endpoint, same code path as the canned tasks. */
function EditablePO({
  po,
  onRun,
  busy,
}: {
  po: PurchaseOrder;
  onRun: (po: PurchaseOrder) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<PurchaseOrder>(po);

  const field = (
    key: keyof PurchaseOrder,
    label: string,
    type: "text" | "number" = "text"
  ) => (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">{label}</span>
      <input
        type={type}
        value={String(draft[key])}
        onChange={(e) =>
          setDraft({
            ...draft,
            [key]: type === "number" ? Number(e.target.value) : e.target.value,
          })
        }
        className="w-full rounded-lg border border-edge bg-white px-2 py-1 font-mono text-[12px] text-ink-900 outline-none focus:border-rain-400 focus:ring-2 focus:ring-rain-100"
      />
    </label>
  );

  return (
    <div className="space-y-3 border-t border-edge px-4 py-3">
      <p className="text-[12px] text-muted">
        Change anything — vendor, SKU, quantity, a cent over the quote — then issue. This
        posts to the same endpoint the tasks above use.
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {field("poNumber", "po number")}
        {field("vendor", "vendor")}
        {field("sku", "sku")}
        {field("costCentre", "cost centre")}
        {field("unitPrice", "unit price (cents)", "number")}
        {field("quantity", "quantity", "number")}
      </div>
      <div className="flex items-center justify-between">
        <span className="tabular font-mono text-[12px] text-ink-500">
          total ${((draft.unitPrice * draft.quantity) / 100).toFixed(2)}
        </span>
        <Button onClick={() => onRun(draft)} disabled={busy} variant="primary">
          Verify and issue
        </Button>
      </div>
    </div>
  );
}

export function RunPanel({
  tasks,
  stages,
  busy,
  ranTasks,
  onRunTask,
  onRunPO,
  onReset,
}: {
  tasks: Task[];
  stages: Stage[];
  busy: boolean;
  ranTasks: Set<string>;
  onRunTask: (task: Task) => void;
  onRunPO: (po: PurchaseOrder) => void;
  onReset: () => void;
}) {
  const [openForm, setOpenForm] = useState(false);

  return (
    <Panel
      title="Agents"
      right={
        <Button variant="ghost" onClick={onReset} disabled={busy} title="Clear cards and live decisions; seeded history is kept">
          Reset demo
        </Button>
      }
    >
      <ul className="divide-y divide-edge">
        {tasks.map((t) => {
          const alreadyRun = ranTasks.has(t.id);
          return (
            <li key={t.id} className="flex items-start gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13.5px] font-medium text-ink-900">{t.label}</p>
                  <Badge tone="neutral">{t.agent}</Badge>
                </div>
                <p className="mt-0.5 text-[12px] text-muted">{t.note}</p>
              </div>
              <Button
                onClick={() => onRunTask(t)}
                disabled={busy}
                variant={alreadyRun ? "primary" : "default"}
                title={
                  alreadyRun
                    ? "Nothing has changed except the record the first run wrote"
                    : undefined
                }
              >
                {alreadyRun ? "Run again" : "Run task"}
              </Button>
            </li>
          );
        })}
      </ul>

      {stages.length > 0 && (
        <div className="border-t border-edge bg-ink-50/60 px-4 py-3.5">
          <StageTrace stages={stages} />
        </div>
      )}

      <div className="border-t border-edge px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpenForm((v) => !v)}
          className="text-[12px] text-muted transition hover:text-ink-900"
        >
          {openForm ? "− Hide" : "+ Write your own purchase order"}
        </button>
      </div>

      {openForm && tasks[0] && (
        <EditablePO po={tasks[0].po} onRun={onRunPO} busy={busy} />
      )}
    </Panel>
  );
}
