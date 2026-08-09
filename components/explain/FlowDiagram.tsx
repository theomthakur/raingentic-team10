/**
 * The actual picture: boxes and arrows, not a list pretending to be one.
 *
 * Colors carry meaning, not decoration: black/white boxes are the agent's own logic,
 * green is the one deterministic gate everything passes through, red is the dead end
 * (no card, ever), pink is every touchpoint that belongs to Rain, and purple is the
 * Monad receipt that has to verify before the Rain call can happen.
 */

type Owner = "agent" | "check" | "refuse" | "rain" | "monad" | "record" | "rules";

interface Node {
  id: string;
  n?: string;
  title: string;
  caption: string;
  x: number;
  y: number;
  owner: Owner;
  dashed?: boolean;
}

const COLORS: Record<Owner, { stroke: string; fill: string; text: string }> = {
  agent: { stroke: "#cdd1d9", fill: "#ffffff", text: "#333844" },
  check: { stroke: "#21bd4b", fill: "#ecfdf1", text: "#117932" },
  refuse: { stroke: "#e0193f", fill: "#fef2f2", text: "#e0193f" },
  rain: { stroke: "#ff2fb6", fill: "#fff0fa", text: "#b30f7c" },
  monad: { stroke: "#6e54ff", fill: "#f1efff", text: "#4c37cc" },
  record: { stroke: "#333844", fill: "#ffffff", text: "#121212" },
  rules: { stroke: "#9aa1ad", fill: "#f2f3f5", text: "#4b5160" },
};

const W = 160;
const H = 60;

const NODES: Node[] = [
  { id: "rules", title: "Rule config", caption: "versioned data, not code", x: 640, y: 8, owner: "rules", dashed: true },
  { id: "task", n: "1", title: "Task", caption: "agent is given a job", x: 10, y: 92, owner: "agent" },
  { id: "quote", n: "1b", title: "Quote", caption: "sellers bid, one wins", x: 210, y: 92, owner: "agent" },
  { id: "propose", n: "2", title: "Propose", caption: "agent declares the PO", x: 410, y: 92, owner: "agent" },
  { id: "verify", n: "3", title: "Verify", caption: "11 deterministic checks", x: 640, y: 92, owner: "check" },
  { id: "refuse", n: "4a", title: "Refuse", caption: "no card, ever", x: 860, y: 92, owner: "refuse" },
  { id: "anchor", n: "4b", title: "Monad proof", caption: "hash + receipt verified", x: 10, y: 234, owner: "monad" },
  { id: "issue", n: "5", title: "Rain API", caption: "scoped card issued", x: 210, y: 234, owner: "rain" },
  { id: "settle", n: "6", title: "Settle", caption: "sandbox purchase", x: 410, y: 234, owner: "rain" },
  { id: "record", n: "7", title: "Record", caption: "append-only log", x: 610, y: 234, owner: "record" },
  { id: "revoke", n: "8", title: "Revoke", caption: "card deactivated", x: 810, y: 234, owner: "rain" },
];

function NodeBox({ node }: { node: Node }) {
  const c = COLORS[node.owner];
  return (
    <g>
      <rect
        x={node.x}
        y={node.y}
        width={W}
        height={H}
        rx={12}
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth={1.5}
        strokeDasharray={node.dashed ? "4 3" : undefined}
      />
      {node.n && (
        <>
          <circle cx={node.x + 18} cy={node.y + 18} r={11} fill="#ffffff" stroke={c.stroke} strokeWidth={1.5} />
          <text x={node.x + 18} y={node.y + 22} textAnchor="middle" fontSize={10} fontWeight={700} fill={c.text} fontFamily="ui-monospace, monospace">
            {node.n}
          </text>
        </>
      )}
      <text x={node.x + W / 2} y={node.y + (node.n ? 33 : 27)} textAnchor="middle" fontSize={13.5} fontWeight={600} fill={c.text}>
        {node.title}
      </text>
      <text x={node.x + W / 2} y={node.y + (node.n ? 49 : 44)} textAnchor="middle" fontSize={10.5} fill={c.text} opacity={0.8}>
        {node.caption}
      </text>
    </g>
  );
}

export function FlowDiagram() {
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const cx = (n: Node) => n.x + W / 2;
  const cy = (n: Node) => n.y + H / 2;

  return (
    <div className="overflow-x-auto rounded-2xl border border-edge bg-white p-4 shadow-sm shadow-ink-900/[0.03]">
      <svg viewBox="0 0 1040 330" className="h-auto w-full min-w-[860px]" role="img" aria-label="Mandate architecture: task, quote, propose, verify, then either refuse or verify Monad policy proof before issuing, settling, recording, and revoking through Rain.">
        <defs>
          <marker id="arrow-gray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#c3c8d1" />
          </marker>
          <marker id="arrow-mint" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#21bd4b" />
          </marker>
          <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#e0193f" />
          </marker>
          <marker id="arrow-purple" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#6e54ff" />
          </marker>
        </defs>

        {/* main left-to-right chain, top row */}
        <line x1={cx(byId.task) + W / 2} y1={cy(byId.task)} x2={byId.quote.x} y2={cy(byId.quote)} stroke="#c3c8d1" strokeWidth={1.5} markerEnd="url(#arrow-gray)" />
        <line x1={cx(byId.quote) + W / 2} y1={cy(byId.quote)} x2={byId.propose.x} y2={cy(byId.propose)} stroke="#c3c8d1" strokeWidth={1.5} markerEnd="url(#arrow-gray)" />
        <line x1={cx(byId.propose) + W / 2} y1={cy(byId.propose)} x2={byId.verify.x} y2={cy(byId.verify)} stroke="#c3c8d1" strokeWidth={1.5} markerEnd="url(#arrow-gray)" />

        {/* rules feeding into verify */}
        <line x1={cx(byId.rules)} y1={byId.rules.y + H - 16} x2={cx(byId.verify)} y2={byId.verify.y} stroke="#9aa1ad" strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#arrow-gray)" />

        {/* verify -> refuse (fail branch) */}
        <line x1={cx(byId.verify) + W / 2} y1={cy(byId.verify)} x2={byId.refuse.x} y2={cy(byId.refuse)} stroke="#e0193f" strokeWidth={1.5} markerEnd="url(#arrow-red)" />
        <text x={(cx(byId.verify) + W / 2 + byId.refuse.x) / 2} y={cy(byId.verify) - 8} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="#e0193f">
          any fails
        </text>

        {/* verify -> Monad proof (pass branch), then and only then the Rain API */}
        <path
          d={`M ${cx(byId.verify)} ${byId.verify.y + H} V 194 H ${cx(byId.anchor)} V ${byId.anchor.y}`}
          fill="none"
          stroke="#21bd4b"
          strokeWidth={1.5}
          markerEnd="url(#arrow-mint)"
        />
        <text x={cx(byId.verify) + 8} y={188} fontSize={10.5} fontWeight={600} fill="#117932">
          all 11 pass
        </text>

        {/* proof -> Rain -> settlement -> durable evidence -> revoke */}
        <line x1={cx(byId.anchor) + W / 2} y1={cy(byId.anchor)} x2={byId.issue.x} y2={cy(byId.issue)} stroke="#6e54ff" strokeWidth={1.5} markerEnd="url(#arrow-purple)" />
        <line x1={cx(byId.issue) + W / 2} y1={cy(byId.issue)} x2={byId.settle.x} y2={cy(byId.settle)} stroke="#c3c8d1" strokeWidth={1.5} markerEnd="url(#arrow-gray)" />
        <line x1={cx(byId.settle) + W / 2} y1={cy(byId.settle)} x2={byId.record.x} y2={cy(byId.record)} stroke="#c3c8d1" strokeWidth={1.5} markerEnd="url(#arrow-gray)" />
        <line x1={cx(byId.record) + W / 2} y1={cy(byId.record)} x2={byId.revoke.x} y2={cy(byId.revoke)} stroke="#c3c8d1" strokeWidth={1.5} markerEnd="url(#arrow-gray)" />

        {NODES.map((n) => (
          <NodeBox key={n.id} node={n} />
        ))}
      </svg>
    </div>
  );
}
