import type { Cents } from "./types";

/** Cents in, human out. Shared by the checkers' reason text and the UI, so a refusal
 *  reads with the same numbers on screen as in the log. */
export function money(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function shortTime(iso: string): string {
  return iso.slice(11, 16);
}

export function shortDate(iso: string): string {
  return iso.slice(0, 10);
}
