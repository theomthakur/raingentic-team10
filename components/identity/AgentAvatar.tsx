import { getAgent } from "@/lib/agents";
import { AGENT_FACES } from "./AgentFaces";

export function AgentAvatar({
  id,
  size = 28,
  className = "",
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  const agent = getAgent(id);
  const Face = AGENT_FACES[agent.face];

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: `${agent.color}17`,
        boxShadow: `0 1px 2px ${agent.color}22`,
      }}
      title={`${agent.name}, ${agent.role}`}
    >
      <span className="absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 0 0 1.5px ${agent.color}55` }} />
      <Face hair={agent.color} width={size} height={size} className="relative" />
    </span>
  );
}
