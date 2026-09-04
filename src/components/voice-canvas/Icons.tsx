import type { SVGProps } from "react";

export type IconName =
  | "annotation"
  | "chart"
  | "check"
  | "chevron"
  | "cloud"
  | "eye"
  | "eyeOff"
  | "fit"
  | "image"
  | "lock"
  | "more"
  | "pen"
  | "pointer"
  | "search"
  | "share"
  | "shape"
  | "spark"
  | "table"
  | "text"
  | "undo"
  | "unlock"
  | "warning";

type IconProps = SVGProps<SVGSVGElement> & { name: IconName };

export function Icon({ name, ...props }: IconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const content: Record<IconName, React.ReactNode> = {
    annotation: <path d="M4 5.5h16v11H10l-5 4v-4H4z" />,
    chart: (
      <>
        <path d="M5 20V11h3v9M11 20V4h3v16M17 20v-6h3v6" />
        <path d="M3 20.5h19" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    cloud: <path d="M7 18h11a4 4 0 0 0 .6-7.95A6.8 6.8 0 0 0 5.7 8.4 4.8 4.8 0 0 0 7 18Z" />,
    eye: (
      <>
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    eyeOff: (
      <>
        <path d="m3 3 18 18M10.6 6.2A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a14.7 14.7 0 0 1-2.1 2.8M6.6 6.6C4 8.3 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3.4-.6" />
        <path d="M10.4 10.4a2.4 2.4 0 0 0 3.2 3.2" />
      </>
    ),
    fit: (
      <>
        <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
        <path d="m3 8 6-6M21 8l-6-6M3 16l6 6M21 16l-6 6" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="1" />
        <circle cx="8" cy="9" r="1.4" />
        <path d="m4 18 5-5 3.5 3 3-4L21 18" />
      </>
    ),
    lock: (
      <>
        <rect x="6" y="10" width="12" height="10" rx="1.5" />
        <path d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3" />
      </>
    ),
    more: (
      <>
        <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    pen: (
      <>
        <path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z" />
        <path d="m13.5 7 3.5 3.5" />
      </>
    ),
    pointer: <path d="m5 3 14 9-6 1.5-3 5.5L5 3Z" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    share: (
      <>
        <path d="M12 16V3M8 7l4-4 4 4" />
        <path d="M5 12v8h14v-8" />
      </>
    ),
    shape: <rect x="4" y="5" width="16" height="14" rx="1" />,
    spark: (
      <>
        <path d="M10.5 3.5c.7 4.6 2.4 6.3 7 7-4.6.7-6.3 2.4-7 7-.7-4.6-2.4-6.3-7-7 4.6-.7 6.3-2.4 7-7Z" />
        <path d="M18.5 3v4M16.5 5h4" />
      </>
    ),
    table: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
      </>
    ),
    text: (
      <>
        <path d="M5 5h14M12 5v15M8.5 20h7" />
      </>
    ),
    undo: (
      <>
        <path d="m8 8-5 4 5 4" />
        <path d="M4 12h9a7 7 0 0 1 7 7" />
      </>
    ),
    unlock: (
      <>
        <rect x="6" y="10" width="12" height="10" rx="1.5" />
        <path d="M9 10V7a3.5 3.5 0 0 1 6.5-1.8" />
      </>
    ),
    warning: (
      <>
        <path d="M12 3 2.8 20h18.4L12 3Z" />
        <path d="M12 9v5M12 17.2v.1" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...common} {...props}>
      {content[name]}
    </svg>
  );
}

export function VoiceCanvasMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7c-2.8-7.5-9-2.5-6.1 3.2C7 5.7 3.3 12.4 9.7 14.1c-7.8.4-7.7 8.6-.1 8.3-6.2 2.9-2 9.1 3.5 5.5-2.6 6.5 5.2 8.5 7 2.1 2.1 6.7 9.8 4.1 6.8-2.2 5.5 3.7 9.7-2.5 3.4-5.4 7.8.2 7.7-8-.1-8.3 6.4-1.7 2.7-8.4-4.1-3.9C28.9 4.4 22.8-.5 20 7Z" />
        <circle cx="20" cy="19" r="4.1" />
      </g>
    </svg>
  );
}
