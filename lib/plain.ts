import type { Outcome, RuleId } from "./types";

/**
 * Codes to English.
 *
 * The system of record speaks in SKUs, cost-centre codes and rule ids, and it has to —
 * those are the identifiers the checks actually compare. But the person reading this
 * screen is a finance controller deciding whether to trust an agent with a card, and
 * "25 × VO-DESK-S2 · CC-ENG" makes them decode three things before they learn anything.
 *
 * So the code stays, as the secondary detail an auditor needs, and the plain words go
 * first. Nothing here changes a decision; this is presentation only.
 */

const PRODUCTS: Record<string, string> = {
  "AM-ALLOY-7": "Alloy stock, grade 7",
  "AM-ALLOY-9": "Alloy stock, grade 9",
  "BW-CONV-90": "Conveyor section, 90cm",
  "BW-CONV-92": "Conveyor section, 92cm",
  "KC-RLY-04": "Control relay, 4-pole",
  "KC-SEN-118": "Proximity sensor",
  "NH-BRK-2200": "Steel mounting bracket",
  "NH-SEAL-91": "Hydraulic seal kit",
  "PL-FRT-EU3": "EU freight lane booking",
  "VO-CHAIR-M4": "Task chair, M4",
  "VO-DESK-S2": "Standing desk, S2",
  "SKU-4471": "A4 paper, 5-ream box",
  "GPU-A100-1H": "A100 GPU, compute hour",
};

const DEPARTMENTS: Record<string, string> = {
  "CC-ENG": "Engineering",
  "CC-FAC": "Facilities",
  "CC-OPS": "Operations",
  "CC-MKT": "Marketing",
};

/**
 * Each rule as the yes/no question it actually asks.
 *
 * A rule id tells you nothing unless you wrote it. The question tells you what would have
 * to be true for the money to move, which is the thing a controller is deciding.
 */
const RULE_QUESTIONS: Record<RuleId, string> = {
  "po-exists": "Is this order on the books?",
  "po-open": "Is it still open and unpaid?",
  "amount-matches": "Does the amount match the quote?",
  "line-matches": "Is it the right supplier and item?",
  "within-budget": "Is there budget left to cover it?",
  "no-existing-card": "Has a card already been issued for it?",
  "requires-approval": "Is it inside this agent's spending authority?",
  "no-structuring": "Is this a big purchase split up to duck approval?",
  "agent-authority": "Is it inside this particular agent's own limit?",
  "known-vendor": "Have we ever paid this supplier before?",
  velocity: "Is this agent buying faster than it should?",
};

export function productName(sku: string): string {
  return PRODUCTS[sku] ?? sku;
}

export function departmentName(costCentre: string): string {
  return DEPARTMENTS[costCentre] ?? costCentre;
}

export function ruleQuestion(ruleId: RuleId): string {
  return RULE_QUESTIONS[ruleId] ?? ruleId;
}

/** One sentence a non-specialist can act on, per outcome. */
export function outcomeSummary(outcome: Outcome): { label: string; meaning: string } {
  switch (outcome) {
    case "approved":
      return {
        label: "Approved",
        meaning: "Every check passed, so a card was issued for exactly this purchase and retired afterwards.",
      };
    case "held":
      return {
        label: "Waiting for a person",
        meaning: "Nothing is wrong with it — it is simply above this agent's limit, so no card exists until someone releases it.",
      };
    case "refused":
      return {
        label: "Refused",
        meaning: "A check failed, so no card was ever created. There is nothing to cancel or claw back.",
      };
  }
}
