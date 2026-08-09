import Link from "next/link";

/**
 * The live demo has one front door. The deeper pages remain available by URL for follow-up
 * questions, but they do not compete with the autonomous run on the primary surface.
 */

export const PAGES = [
  { href: "/", label: "Agent control", blurb: "watch an autonomous purchase run" },
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
        {PAGES.length > 1 && <SiteNav current={current} />}
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
