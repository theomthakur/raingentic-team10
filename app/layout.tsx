import type { Metadata } from "next";
import { Inter, Fraunces, Roboto_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

// Rain's own site is set in a proprietary light-weight editorial serif ("Antique Legacy",
// confirmed from rain.xyz's stylesheet: not licensable here). Fraunces is the closest
// free relative in the same spirit: warm, light, a little unexpected for a fintech screen.
// Used only for display headlines, not body copy.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "500"],
  variable: "--font-display",
  display: "swap",
});

// Monad's site is genuinely set in Roboto Mono (confirmed from monad.xyz's stylesheet),
// this one is a real, exact, freely-licensable match, so every PO number, hash, and rule
// id in the console now renders in it instead of the generic system mono stack.
const robotoMono = Roboto_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Mandate: the reason, checked before the card exists",
  description:
    "Rain bounds how much an agent spends and where. Mandate checks why, and if the reason does not hold, no card is ever issued.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${robotoMono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
