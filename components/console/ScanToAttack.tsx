"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { ChallengeStats } from "@/lib/challenge";

/**
 * Scan to attack.
 *
 * Every other part of a pitch asks a judge to believe something. This asks them to
 * disprove it, from their own phone, while you are still talking, and the counter behind
 * you moves when they do, because it is the same deployment and the same append-only log.
 *
 * The number is derived from the log rather than incremented alongside it, so it is
 * checkable: every attempt is a decision row a judge can open and audit. That matters more
 * than the drama. A scoreboard nobody can verify is just a claim in a bigger font.
 *
 * The QR encodes wherever this is actually being served from, never a hardcoded URL, so
 * it is correct on localhost, on a preview build, and in production without anyone
 * remembering to change it.
 */
export function ScanToAttack({ stats }: { stats: ChallengeStats }) {
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const target = `${window.location.origin}/#break-it`;
    setUrl(target);
    QRCode.toDataURL(target, {
      margin: 1,
      width: 320,
      color: { dark: "#121212", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, []);

  const local = url.includes("localhost") || url.includes("127.0.0.1");

  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-edge bg-white px-5 py-6 sm:flex-row sm:items-center sm:gap-7">
      <div className="shrink-0 rounded-xl border border-edge bg-white p-2">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR code linking to ${url}`} className="h-32 w-32" />
        ) : (
          <div className="h-32 w-32 animate-pulse rounded bg-ink-100" />
        )}
      </div>

      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="font-display text-[22px] font-medium leading-tight tracking-[-0.01em] text-ink-900">
          Don&apos;t take our word for it.
        </p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          Scan it and try to get money out, from your seat, right now. Everyone in the room
          is attacking the same deployment. The counter below is shared, and every attempt
          is a decision you can open and audit.
        </p>

        <div className="mt-4 flex items-center justify-center gap-6 sm:justify-start">
          <div>
            <div className="tabular font-mono text-[30px] font-semibold leading-none text-ink-900">
              {stats.attempts}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-ink-400">
              attempts so far
            </div>
          </div>
          <div>
            <div
              className={`tabular font-mono text-[30px] font-semibold leading-none ${
                stats.defeats > 0 ? "text-fail" : "text-mint-700"
              }`}
            >
              {stats.defeats}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-ink-400">
              cards that shouldn&apos;t exist
            </div>
          </div>
          <div>
            <div className="tabular font-mono text-[30px] font-semibold leading-none text-ink-500">
              {stats.rulesTriggered.length}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-ink-400">
              checks people have hit
            </div>
          </div>
        </div>

        {local && (
          // Worth saying out loud rather than letting someone hold a phone up to a QR that
          // points at a laptop nobody else can reach.
          <p className="mt-3 text-[11px] text-warn">
            Running locally: this QR points at {url}, which only works on this machine.
            Deployed, it points at the live URL automatically.
          </p>
        )}
      </div>
    </div>
  );
}
