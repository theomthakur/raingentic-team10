import type { SVGProps } from "react";

/**
 * Five compact operator glyphs, not people. The shared visor makes them feel like one
 * team of agents; each colored crest gives the roster a distinct personality at 20px.
 */

const SHELL = "#172033";
const FEATURE = "#dff8ff";

function Head({ children }: { children: React.ReactNode }) {
  return (
    <>
      <rect x="4.6" y="6.4" width="14.8" height="12.4" rx="5.5" fill={SHELL} />
      <path d="M7.1 12h9.8" stroke={FEATURE} strokeWidth="1.35" strokeLinecap="round" />
      <circle cx="9" cy="12" r="1.1" fill={FEATURE} />
      <circle cx="15" cy="12" r="1.1" fill={FEATURE} />
      <path d="M12 18.8v2.1" stroke={SHELL} strokeWidth="1.5" strokeLinecap="round" />
      {children}
    </>
  );
}

type FaceProps = SVGProps<SVGSVGElement> & { hair: string };

export function RaeFace({ hair, ...props }: FaceProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <Head>
        <path d="M5 13.5a7 7 0 0 1 14 0v-.6C17.5 11 15 10.2 12 10.2S6.5 11 5 12.9z" fill={hair} />
        <rect x="4.6" y="11.5" width="2.1" height="7.5" rx="1" fill={hair} />
        <rect x="17.3" y="11.5" width="2.1" height="7.5" rx="1" fill={hair} />
      </Head>
    </svg>
  );
}

export function MonaFace({ hair, ...props }: FaceProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <Head>
        <path
          d="M5.2 12.5 6.8 8.6 8.6 11.4 10.4 8 12 11 13.6 8 15.4 11.4 17.2 8.6 18.8 12.5c-1.4-1.6-4-2.4-6.8-2.4s-5.4.8-6.8 2.4z"
          fill={hair}
        />
      </Head>
    </svg>
  );
}

export function PrueFace({ hair, ...props }: FaceProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <Head>
        <path d="M5 13a7 7 0 0 1 13.6-2.2C16.8 9.6 14.6 9.6 12 10.4c-2.6.8-5.4 1.3-7 2.6z" fill={hair} />
        <rect x="7.4" y="11.7" width="3.4" height="2.4" rx="0.6" fill="none" stroke={FEATURE} strokeWidth="0.8" />
        <rect x="13.2" y="11.7" width="3.4" height="2.4" rx="0.6" fill="none" stroke={FEATURE} strokeWidth="0.8" />
        <line x1="10.8" y1="12.8" x2="13.2" y2="12.8" stroke={FEATURE} strokeWidth="0.8" />
      </Head>
    </svg>
  );
}

export function LucaFace({ hair, ...props }: FaceProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <Head>
        {[
          [6.3, 10.6], [8.4, 8.8], [10.8, 7.9], [13.2, 7.9], [15.6, 8.8], [17.7, 10.6],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="2" fill={hair} />
        ))}
      </Head>
    </svg>
  );
}

export function CodyFace({ hair, ...props }: FaceProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <Head>
        <path d="M5 13.2a7 7 0 0 1 14 0c-1.6-1.7-4.2-2.6-7-2.6s-5.4.9-7 2.6z" fill={hair} />
        <circle cx="12" cy="7.6" r="2.1" fill={hair} />
      </Head>
    </svg>
  );
}

export function GenericFace({ hair, ...props }: FaceProps) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <Head>
        <path d="M5.2 13a6.9 6.9 0 0 1 13.6 0c-1.3-1.4-3.9-2.2-6.8-2.2s-5.5.8-6.8 2.2z" fill={hair} />
      </Head>
    </svg>
  );
}

export const AGENT_FACES = {
  rae: RaeFace,
  mona: MonaFace,
  prue: PrueFace,
  luca: LucaFace,
  cody: CodyFace,
  generic: GenericFace,
} as const;

export type AgentFaceKey = keyof typeof AGENT_FACES;
