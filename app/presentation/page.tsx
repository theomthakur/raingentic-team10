import Link from "next/link";
import { Badge } from "@/components/ui";
import { Deck } from "@/components/Deck";
import { Footer } from "@/components/Footer";
import { SubPageHeader } from "@/components/SiteNav";

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
      <SubPageHeader current="/presentation" />

      <main>
        <Deck />
      </main>

      <Footer />
    </div>
  );
}
