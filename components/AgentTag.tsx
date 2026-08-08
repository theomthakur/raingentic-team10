import { getAgent } from "@/lib/agents";
import { AgentAvatar } from "./AgentAvatar";

export function AgentTag({ id, size = "sm" }: { id: string; size?: "sm" | "md" }) {
  const agent = getAgent(id);
  const dims = size === "md" ? 26 : 20;
  return (
    <span className="inline-flex items-center gap-1.5">
      <AgentAvatar id={id} size={dims} />
      <span className={size === "md" ? "text-[13px]" : "text-[12px]"}>
        <span className="font-medium text-ink-800">{agent.name}</span>
        <span className="text-ink-400"> — deals with {agent.dealsWith}</span>
      </span>
    </span>
  );
}
