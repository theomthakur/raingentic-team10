import { Badge, Panel } from "../ui";

/**
 * What Rain's Agent Control Layer covers, what Mandate adds, and where the two overlap.
 *
 * This panel exists because "we check *why*" is too vague to survive a follow-up question
 * from someone who works at Rain. Every dimension below is quoted from Rain's own
 * published material rather than inferred, and the overlap is stated rather than hidden —
 * three of the eleven checks partly duplicate controls Rain already enforces, and
 * pretending otherwise in front of the people who built it would be the fastest way to
 * lose the argument.
 *
 * The honest split: Rain's six dimensions all describe the **instrument** — how much,
 * where, how often, how long. None of them describe the **obligation** the spend is
 * supposed to settle, because a card issuer has no view of a purchase-order system.
 *
 * Sources:
 * - https://www.rain.xyz/resources/introducing-the-agent-control-layer
 * - https://www.prnewswire.com/news-releases/rain-releases-agent-control-layer-bringing-programmatic-spending-guardrails-to-agentic-payments-302794541.html
 */

interface Dimension {
  name: string;
  /** How Mandate relates to this control. */
  stance: "we-set-it" | "overlap" | "rain-only";
  note: string;
}

/**
 * Rain's enumerated control dimensions. The press release lists these as merchant
 * category codes, approved merchants or payment recipients, transaction amounts,
 * transaction frequency, the number of active agent cards, and card expiry.
 */
const RAIN_DIMENSIONS: Dimension[] = [
  {
    name: "Transaction amount",
    stance: "overlap",
    note: "We scope the card to the exact PO total, never a round number. Check 3 also verifies it against the accepted quote before we ask.",
  },
  {
    name: "Approved merchants",
    stance: "overlap",
    note: "Exact-merchant allowlisting, not just categories. Check 4 verifies the vendor against the quote — so this is defence in depth, not a gap in Rain.",
  },
  {
    name: "Merchant category codes",
    stance: "rain-only",
    note: "Rain's control. We do not duplicate it.",
  },
  {
    // Was listed as Rain's alone, on the reasoning that single-purpose cards make frequency
    // moot. That stopped being true the moment check 11 shipped: a velocity limit is a
    // frequency control. Claiming otherwise, in the panel built to prove we don't duplicate
    // Rain, was the one false statement on the site.
    name: "Transaction frequency",
    stance: "overlap",
    note: "Rain limits how often a card can be used. We limit how fast an agent buys across every card it holds — a looping agent's purchases are each individually perfect, so only a rate sees it. Related controls, different subject.",
  },
  {
    name: "Card expiry",
    stance: "we-set-it",
    note: "We set expiry to the quote's own expiry, so the instrument cannot outlive the offer that justified it.",
  },
  {
    name: "Active card count / aggregate spend",
    stance: "overlap",
    note: "Program-level in Rain. Check 5 enforces a per-cost-centre budget, which is a different axis than a program-wide cap.",
  },
];

/** The obligation-level checks. None are expressible as a card control at any granularity. */
const MANDATE_ONLY: { name: string; check: string; why: string }[] = [
  {
    name: "Which obligation this spend settles",
    check: "check 1",
    why: "The PO must exist and have been accepted. A card control cannot ask this, because the issuer has no view of your order system.",
  },
  {
    name: "Whether that obligation is still open",
    check: "check 2",
    why: "A fulfilled line, or an expired quote, must not be paid. Nothing about the instrument encodes whether the job is already done.",
  },
  {
    name: "Which specific item",
    check: "check 4 (SKU)",
    why: "Right supplier, right total, wrong item. Passes every amount, merchant, category and frequency limit that exists.",
  },
  {
    name: "Whether we already issued for this line",
    check: "check 6",
    why: "Idempotency keyed on the order line. A retry returns the existing card instead of creating a second one — and a revoked card still counts.",
  },
  {
    name: "Who must approve above a threshold",
    check: "check 7",
    why: "Delegated authority. Above the limit the purchase is held, not refused, and a named person releases it. No card exists while it waits.",
  },
];

const STANCE: Record<Dimension["stance"], { label: string; tone: "rain" | "warn" | "neutral" }> = {
  "we-set-it": { label: "we set it", tone: "rain" },
  overlap: { label: "overlap", tone: "warn" },
  "rain-only": { label: "Rain's", tone: "neutral" },
};

export function ControlCoverage() {
  return (
    <div className="space-y-4">
      <Panel
        title="What Rain's Agent Control Layer already enforces"
        right={<Badge tone="rain">6 dimensions</Badge>}
      >
        <ul className="divide-y divide-edge">
          {RAIN_DIMENSIONS.map((d) => (
            <li key={d.name} className="px-5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13.5px] font-medium text-ink-900">{d.name}</p>
                <Badge tone={STANCE[d.stance].tone}>{STANCE[d.stance].label}</Badge>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{d.note}</p>
            </li>
          ))}
        </ul>
        <p className="border-t border-edge px-5 py-3 text-[12.5px] leading-relaxed text-muted">
          Every one of these describes the <b className="text-ink-800">instrument</b>: how
          much, where, how often, how long. Three of our checks partly overlap them, and we
          say so — Rain decides whether to <i>allow</i>, we decide whether to{" "}
          <i>ask at all</i>.
        </p>
      </Panel>

      <Panel
        title="What no card control can express, at any granularity"
        right={<Badge tone="pass">5 checks</Badge>}
      >
        <ul className="divide-y divide-edge">
          {MANDATE_ONLY.map((m) => (
            <li key={m.name} className="px-5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13.5px] font-medium text-ink-900">{m.name}</p>
                <code className="shrink-0 font-mono text-[10.5px] text-ink-400">
                  {m.check}
                </code>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{m.why}</p>
            </li>
          ))}
        </ul>
        <p className="border-t border-edge px-5 py-3 text-[12.5px] leading-relaxed text-muted">
          These describe the <b className="text-ink-800">obligation</b>, not the instrument.
          A card issuer cannot see a purchase-order system, so none of them are expressible
          as an amount, a merchant, a category, a frequency or an expiry.
        </p>
      </Panel>

      <p className="text-[12.5px] leading-relaxed text-muted">
        Dimensions taken from Rain's{" "}
        <a
          className="text-rain-600 underline decoration-rain-500/30 underline-offset-2 hover:decoration-rain-500"
          href="https://www.rain.xyz/resources/introducing-the-agent-control-layer"
          target="_blank"
          rel="noreferrer noopener"
        >
          Agent Control Layer announcement
        </a>{" "}
        and its{" "}
        <a
          className="text-rain-600 underline decoration-rain-500/30 underline-offset-2 hover:decoration-rain-500"
          href="https://www.prnewswire.com/news-releases/rain-releases-agent-control-layer-bringing-programmatic-spending-guardrails-to-agentic-payments-302794541.html"
          target="_blank"
          rel="noreferrer noopener"
        >
          press release
        </a>
        , which lists approved merchants separately from merchant category codes — so exact
        merchant locking is supported, and we do not claim Rain misses it.
      </p>
    </div>
  );
}
