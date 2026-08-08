/** Integer cents throughout. See crossval-pricing/lib/money.ts for the fuller version;
 * this is the trimmed subset Mandate actually needs. */

export function toCents(input: string | number): number {
  const raw = String(input).trim();
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) throw new Error(`"${input}" is not a valid amount.`);
  const [, sign, whole, frac = ""] = match;
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
  return sign ? -cents : cents;
}

export function fromCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  return `${negative ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
