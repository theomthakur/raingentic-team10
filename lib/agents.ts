/**
 * A name and a face for every id that shows up in `Decision.agent`.
 *
 * The id itself (`facilities-01`) is what the system actually keys on — nothing here
 * changes behavior. This is purely so a judge watching the feed sees "Nora, Facilities"
 * make a purchase rather than a string that reads like a service account.
 */
import type { AgentFaceKey } from "@/components/AgentFaces";

export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  /** Short, said-out-loud version: "deals with ___". Used anywhere space is tight. */
  dealsWith: string;
  color: string;
  face: AgentFaceKey;
  description: string;
}

export const AGENTS: Record<string, AgentPersona> = {
  "facilities-01": {
    id: "facilities-01",
    name: "Nora",
    role: "Facilities agent",
    dealsWith: "facility purchases",
    color: "#0891b2",
    face: "nora",
    description: "Declares purchase orders against quotes already on file — desks, chairs, building services. No negotiation stage; Nora's job is to get the declaration exactly right, not to find the price.",
  },
  "procurement-01": {
    id: "procurement-01",
    name: "Kai",
    role: "Procurement agent",
    dealsWith: "freight and logistics",
    color: "#7c3aed",
    face: "kai",
    description: "Runs general procurement against standing quotes — freight lanes, components, logistics. Mid-sized spend, usually under the delegated limit, so most of Kai's purchases clear without a person.",
  },
  "procurement-02": {
    id: "procurement-02",
    name: "Reid",
    role: "Capital procurement agent",
    dealsWith: "capital purchases over $25,000",
    color: "#c2410c",
    face: "reid",
    description: "Handles the purchases everyone else's rules were sized for — equipment, capital orders, the ones that clear every check and still land above $25,000. Reid's PO doesn't get refused; it gets held for a person.",
  },
  "office-supplies": {
    id: "office-supplies",
    name: "Milo",
    role: "Supplies buyer",
    dealsWith: "office supply negotiations",
    color: "#0f9d58",
    face: "milo",
    description: "Runs the office-supplies negotiation: four sellers, one counter-offer round, cheapest qualifying bid wins. Milo never sees a price the negotiation didn't already settle.",
  },
  "cloud-compute": {
    id: "cloud-compute",
    name: "Vera",
    role: "Infra buyer",
    dealsWith: "GPU compute contracts",
    color: "#b30f7c",
    face: "vera",
    description: "Negotiates GPU capacity for training runs across three compute vendors in a tighter, faster-expiring market. Same negotiation engine as Milo's, different sellers and a shorter quote window.",
  },
};

const FALLBACK_COLORS = ["#4b5160", "#0891b2", "#7c3aed", "#c2410c", "#0f9d58", "#b30f7c"];

function hashOf(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export function getAgent(id: string): AgentPersona {
  return (
    AGENTS[id] ?? {
      id,
      name: id,
      role: "Agent",
      dealsWith: "purchases not yet assigned a persona",
      color: FALLBACK_COLORS[hashOf(id) % FALLBACK_COLORS.length],
      face: "generic",
      description: "No persona on file yet for this id.",
    }
  );
}
