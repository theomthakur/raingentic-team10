import Link from "next/link";

/**
 * One nav, every page, always in the same order.
 *
 * Each page used to carry its own bespoke header, so where you could go next depended on
 * where you happened to be: the console offered no way out at all, and the workspace had
 * a second, different nav of its own. In a five-minute demo that is a real cost: every
 * dead end is a fumble in front of a judge.
 *
 * The order is the order you would present in, left to right: what a customer sees, then
 * the machinery behind it, then what is for sale, who spends, how it is built, and the
 * pitch. `blurb` exists because a bare noun does not tell a judge what a page is for,
 * "Catalogue" could be anything until you read "what an agent can buy".
 */

export const PAGES = [
  { href: "/", label: "Mandate", blurb: "give the agent a goal" },
  { href: "/workspace", label: "Activity", blurb: "orders, budgets, and approvals" },
  { href: "/catalog", label: "Sourcing", blurb: "catalogue and supplier competition" },
  { href: "/agents", label: "Agents", blurb: "who is allowed to spend" },
  { href: "/architecture", label: "Proof", blurb: "controls, Rain, and Monad" },
  { href: "/presentation", label: "Deck", blurb: "the pitch" },
] as const;

export function SiteNav({ current }: { current: string }) {
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {PAGES.map((p) => {
        const active = p.href === current;
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={active ? "page" : undefined}
            title={p.blurb}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition ${
              active
                ? "bg-rain-50 text-rain-700"
                : "text-muted hover:bg-ink-50 hover:text-ink-900"
            }`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The mark plus wordmark. Always points to the customer journey, from every page.
 */
export function NavBrand() {
  return (
    <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label="Mandate home">
      <MandateMark />
      <span className="leading-none">
        <span className="block text-[14px] font-semibold tracking-tight text-ink-900 transition group-hover:text-rain-700">Mandate</span>
        <span className="mt-1 block text-[9.5px] font-medium tracking-[0.01em] text-muted">
          Autonomous spend, inside your limits
        </span>
      </span>
    </Link>
  );
}

/**
 * The mark: an aperture. Two brackets holding one payment.
 *
 * A mandate is a bracket: the thing that says everything inside this is authorised and
 * nothing outside it is. So the mark is the two limits with the single payment sitting
 * between them, never touching either edge. That is the whole product in one shape,
 * bounded authority, one purchase at a time.
 *
 * It replaces a shield with a tick inside a pink squircle, which stacked three of the most
 * over-used marks in fintech on top of each other and said nothing specific about this
 * product. Any security company could have used it. Nobody else can use this one without
 * also claiming to be about spending limits.
 *
 * Deliberately no coloured tile behind it. A glyph in a rounded square is the default
 * startup logo, and the geometry should carry the brand on its own.
 *
 * Drawn on a 32 unit grid, with the fill outlined in its own colour so every corner rounds
 * very slightly. The same geometry lives in `app/icon.svg`, so the tab icon and the header
 * are genuinely one drawing rather than two things that resemble each other.
 */
function MandateMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-8 w-8 shrink-0"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <g
        strokeWidth="1.1"
        strokeLinejoin="round"
        className="fill-rain-500 stroke-rain-500 transition-colors group-hover:fill-rain-600 group-hover:stroke-rain-600"
      >
        {/* The two limits. */}
        <path d="M5,6.5 H11 V8.6 H7.6 V23.4 H11 V25.5 H5 Z" />
        <path d="M27,6.5 H21 V8.6 H24.4 V23.4 H21 V25.5 H27 Z" />
      </g>
      {/* The authorised payment, clear of both edges on purpose. */}
      <circle cx="16" cy="16" r="3.4" className="fill-ink-900" />
    </svg>
  );
}

/** The whole bar, for every page except the console (which has the full header). */
/**
 * The bar every page wears, identically.
 *
 * It used to differ by page: the console put the brand and a tagline on one row and the
 * nav underneath, sub-pages put brand and nav together on a shorter row. Same links, but a
 * different shape and height on every page, so moving around felt like moving between
 * three different products. This is now the single top bar; the console adds its hero
 * *below* it rather than instead of it.
 */
export function NavBar({ current }: { current: string }) {
  return (
    <div className="border-b border-edge bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3 md:px-10">
        <NavBrand />
        <SiteNav current={current} />
      </div>
    </div>
  );
}

export function SubPageHeader({ current }: { current: string }) {
  return (
    <header>
      <NavBar current={current} />
    </header>
  );
}
