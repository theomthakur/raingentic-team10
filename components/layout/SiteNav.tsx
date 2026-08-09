import Link from "next/link";

/**
 * One nav, every page, always in the same order.
 *
 * Each page used to carry its own bespoke header, so where you could go next depended on
 * where you happened to be — the console offered no way out at all, and the workspace had
 * a second, different nav of its own. In a five-minute demo that is a real cost: every
 * dead end is a fumble in front of a judge.
 *
 * The order is the order you would present in, left to right: what a customer sees, then
 * the machinery behind it, then what is for sale, who spends, how it is built, and the
 * pitch. `blurb` exists because a bare noun does not tell a judge what a page is for —
 * "Catalogue" could be anything until you read "what an agent can buy".
 */

export const PAGES = [
  { href: "/workspace", label: "Workspace", blurb: "what a customer sees" },
  { href: "/", label: "Console", blurb: "run it and watch the checks" },
  { href: "/catalog", label: "Catalogue", blurb: "what an agent can buy" },
  { href: "/agents", label: "Agents", blurb: "who is allowed to spend" },
  { href: "/architecture", label: "System design", blurb: "how it works" },
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
 * The mark plus wordmark. Always points at the console, from every page including the
 * workspace — a brand that goes somewhere different depending on where you are is how
 * people get lost.
 */
export function NavBrand() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rain-500 text-[12px] font-bold text-white">
        M
      </span>
      <span className="text-[14px] font-semibold tracking-tight text-ink-900">Mandate</span>
    </Link>
  );
}

/** The whole bar, for every page except the console (which has the full header). */
/**
 * The bar every page wears, identically.
 *
 * It used to differ by page — the console put the brand and a tagline on one row and the
 * nav underneath, sub-pages put brand and nav together on a shorter row. Same links, but a
 * different shape and height on every page, so moving around felt like moving between
 * three different products. This is now the single top bar; the console adds its hero
 * *below* it rather than instead of it.
 */
export function NavBar({ current }: { current: string }) {
  return (
    <div className="border-b border-edge bg-white">
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
