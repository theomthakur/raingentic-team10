import Link from "next/link";
import { Badge } from "@/components/ui";
import { Deck } from "@/components/Deck";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Mandate — presentation",
};

/**
 * The pitch, as a route rather than a PDF.
 *
 * Five minutes in front of judges are lost to window-switching: slides in one app, the
 * running product in another. Keeping the deck inside the product means every claim on a
 * slide is one click from the screen that proves it — and the deck can never drift out of
 * date with the build the way an exported file does.
 *
 * Server component, like /architecture, so the page owns its metadata. The deck itself is
 * the only client boundary, because it needs the keyboard.
 */
export default function PresentationPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-edge bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-6 py-5 md:px-10">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[13px] font-medium text-muted transition hover:text-ink-900"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rain-500 text-[12px] font-bold text-white">
              M
            </span>
            ← Back to Mandate
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/architecture"
              className="text-[12.5px] font-medium text-muted underline-offset-4 transition hover:text-ink-900 hover:underline"
            >
              System design →
            </Link>
            <Badge tone="neutral">presentation</Badge>
          </div>
        </div>
      </header>

      <main>
        <Deck />
      </main>

      <Footer />
    </div>
  );
}
