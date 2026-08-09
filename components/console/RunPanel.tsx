"use client";

import type { NegotiatedTask } from "@/lib/fixtures/tasks";
import type { Stage } from "@/lib/pipeline";
import { AgentTag } from "../identity/AgentTag";
import { Button, Panel } from "../ui";

const STAGE_ORDER: Stage["name"][] = [
  "NEGOTIATE",
  "PROPOSE",
  "VERIFY",
  "REFUSE",
  "ISSUE",
  "SETTLE",
  "REVOKE",
  "RECORD",
];

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
              className={`mt-px w-[5.5rem] shrink-0 rounded-full px-2 py-0.5 text-center font-mono text-[10px] font-semibold ${
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

function TaskRow({
  label,
  note,
  agentId,
  alreadyRun,
  busy,
  onRun,
}: {
  label: string;
  note: string;
  agentId: string;
  alreadyRun: boolean;
  busy: boolean;
  onRun: () => void;
}) {
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-2.5 px-4 py-3">
      <div className="min-w-[190px] flex-1">
        <p className="text-[13.5px] font-medium text-ink-900">{label}</p>
        <p className="mt-0.5 text-[12px] text-muted">{note}</p>
        <div className="mt-1.5">
          <AgentTag id={agentId} />
        </div>
      </div>
      <Button
        onClick={onRun}
        disabled={busy}
        variant={alreadyRun ? "primary" : "default"}
        title={alreadyRun ? "Nothing has changed except the record the first run wrote" : undefined}
      >
        {alreadyRun ? "Dispatch again" : "Dispatch agent"}
      </Button>
    </li>
  );
}

export function RunPanel({
  negotiatedTasks,
  stages,
  busy,
  ranTasks,
  onRunNegotiated,
  onReset,
}: {
  negotiatedTasks: NegotiatedTask[];
  stages: Stage[];
  busy: boolean;
  ranTasks: Set<string>;
  onRunNegotiated: (task: NegotiatedTask) => void;
  onReset: () => void;
}) {
  return (
    <Panel
      title="Autonomous agent runs"
      right={
        <Button variant="ghost" onClick={onReset} disabled={busy} title="Clear cards and live decisions; seeded history is kept">
          Reset demo
        </Button>
      }
    >
      <p className="border-b border-edge px-4 py-3 text-[13px] leading-relaxed text-ink-700">
        This console observes the run; it is not an approval screen. Once dispatched, the
        agent negotiates, proposes, verifies and spends within its mandate without a human
        in the purchase path.
      </p>

      <ul className="divide-y divide-edge">
        {negotiatedTasks.map((t) => (
          <TaskRow
            key={t.id}
            label={t.label}
            note={t.note}
            agentId={t.task.taskKey}
            alreadyRun={ranTasks.has(t.id)}
            busy={busy}
            onRun={() => onRunNegotiated(t)}
          />
        ))}
      </ul>

      {stages.length > 0 && (
        <div className="border-t border-edge bg-ink-50/60 px-4 py-3.5">
          <StageTrace stages={stages} />
        </div>
      )}

    </Panel>
  );
}
