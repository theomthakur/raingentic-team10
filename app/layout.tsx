import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mandate — the reason, checked before the card exists",
  description:
    "Rain bounds how much an agent spends and where. Mandate checks why, and if the reason does not hold, no card is ever issued.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
