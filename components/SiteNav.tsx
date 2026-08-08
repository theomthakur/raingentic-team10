import Link from "next/link";

/**
 * One nav, every page, always in the same order.
 *
 * Each page used to carry its own bespoke header, so where you could go next depended on
 * where you happened to be — the catalogue offered no way to reach the agents, and only
 * the architecture page knew the deck existed. In a five-minute demo that is a real cost:
 * every dead end is a fumble in front of a judge.
 *
 * The order is the order you would present in, left to right: pitch it, buy something,
 * see what the checks did, then how it is built and who is spending.
 */

const PAGES = [
  { href: "/workspace", label: "Workspace" },
  { href: "/", label: "Console" },
  { href: "/catalog", label: "Catalogue" },
  { href: "/architecture", label: "System design" },
  { href: "/agents", label: "Agents" },
  { href: "/presentation", label: "Deck" },
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

/** The mark plus wordmark, used as the "home" affordance on every sub-page. */
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
export function SubPageHeader({ current }: { current: string }) {
  return (
    <header className="border-b border-edge bg-white">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-6 py-4 md:px-10">
        <NavBrand />
        <SiteNav current={current} />
      </div>
    </header>
  );
}
