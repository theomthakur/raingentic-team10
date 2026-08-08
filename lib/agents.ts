/**
 * A name and a face for every id that shows up in `Decision.agent`.
 *
 * The id itself (`facilities-01`) is what the system actually keys on — nothing here
 * changes behavior. This is purely so a judge watching the feed sees "Rae, Facilities"
 * make a purchase rather than a string that reads like a service account.
 */
import type { AgentFaceKey } from "@/components/AgentFaces";

export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  /** Short, said-out-loud version: "deals with ___". Used anywhere space is tight. */
  dealsWith: string;
  /** Set when the name is a tribute to one of the three hosts. Drives ordering. */
  host?: "Rain" | "Monad" | "Encode";
  /**
   * Why this agent is called this. Every name earns its place — three are tributes to the
   * hosts (Rain, Monad, Encode), two come from the history of financial control, which is
   * the same argument the rules themselves make: none of this was invented here. A judge
   * who catches the reference gets a second thing to like; one who doesn't just sees
   * ordinary names, which is the property that makes this worth shipping.
   */
  why: string;
  color: string;
  face: AgentFaceKey;
  description: string;
}

export const AGENTS: Record<string, AgentPersona> = {
  "facilities-01": {
    id: "facilities-01",
    name: "Rae",
    role: "Facilities agent",
    dealsWith: "facility purchases",
    host: "Rain",
    why: "For Rain. Rae's refusal is the one that shows why a card control alone can't catch a swapped vendor — the reason has to be checked before the card exists.",
    color: "#0891b2",
    face: "rae",
    description: "Declares purchase orders against quotes already on file — desks, chairs, building services. No negotiation stage; Rae's job is to get the declaration exactly right, not to find the price.",
  },
  "procurement-01": {
    id: "procurement-01",
    name: "Mona",
    role: "Procurement agent",
    dealsWith: "freight and logistics",
    host: "Monad",
    why: "For Monad. Mona's refusals are only provable months later because the rule version that judged them is anchored on chain and cannot be quietly rewritten.",
    color: "#7c3aed",
    face: "mona",
    description: "Runs general procurement against standing quotes — freight lanes, components, logistics. Mid-sized spend, usually under the delegated limit, so most of Mona's purchases clear without a person.",
  },
  "procurement-02": {
    id: "procurement-02",
    name: "Prue",
    role: "Capital procurement agent",
    dealsWith: "capital purchases over $25,000",
    why: "For the prudence principle in accounting: when the amount is large, be conservative and get a person to look. That is exactly the rule Prue's purchases trigger.",
    color: "#c2410c",
    face: "prue",
    description: "Handles the purchases everyone else's rules were sized for — equipment, capital orders, the ones that clear every check and still land above $25,000. Prue's PO doesn't get refused; it gets held for a person.",
  },
  "office-supplies": {
    id: "office-supplies",
    name: "Luca",
    role: "Supplies buyer",
    dealsWith: "office supply negotiations",
    why: "For Luca Pacioli, who codified double-entry bookkeeping in 1494 — the original rule that every entry needs a matching counter-entry. The three-way match this system runs on is his idea, 532 years later.",
    color: "#0f9d58",
    face: "luca",
    description: "Runs the office-supplies negotiation: four sellers, one counter-offer round, cheapest qualifying bid wins. Luca never sees a price the negotiation didn't already settle.",
  },
  "cloud-compute": {
    id: "cloud-compute",
    name: "Cody",
    role: "Infra buyer",
    dealsWith: "GPU compute contracts",
    host: "Encode",
    why: "For Encode — enCODE — the developer community hosting this. Cody buys the training compute that builders actually run on, which is the most builder-shaped line in the catalogue.",
    color: "#b30f7c",
    face: "cody",
    description: "Negotiates GPU capacity for training runs across three compute vendors in a tighter, faster-expiring market. Same negotiation engine as Luca's, different sellers and a shorter quote window.",
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
      why: "No persona on file yet for this id.",
      color: FALLBACK_COLORS[hashOf(id) % FALLBACK_COLORS.length],
      face: "generic",
      description: "No persona on file yet for this id.",
    }
  );
}
