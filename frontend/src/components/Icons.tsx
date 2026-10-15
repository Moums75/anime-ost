import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const Svg = ({ children, ...props }: IconProps) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" {...props}>
    {children}
  </svg>
);

export const PlayIcon = (p: IconProps) => <Svg {...p}><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" /></Svg>;
export const PauseIcon = (p: IconProps) => <Svg {...p}><rect x="6" y="4.5" width="4" height="15" rx="1.2" /><rect x="14" y="4.5" width="4" height="15" rx="1.2" /></Svg>;
export const NextIcon = (p: IconProps) => <Svg {...p}><path d="M5 6.2v11.6a1 1 0 0 0 1.55.83L15 13v4.5a1 1 0 0 0 2 0v-11a1 1 0 0 0-2 0V11L6.55 5.37A1 1 0 0 0 5 6.2Z" /></Svg>;
export const PrevIcon = (p: IconProps) => <Svg {...p}><path d="M19 6.2v11.6a1 1 0 0 1-1.55.83L9 13v4.5a1 1 0 0 1-2 0v-11a1 1 0 0 1 2 0V11l8.45-5.63A1 1 0 0 1 19 6.2Z" /></Svg>;
export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
    <path strokeLinejoin="round" d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4 7.5 4c2 0 3.5 1.1 4.5 2.6C13 5.1 14.5 4 16.5 4c3.6 0 5.9 3.6 4.7 7.1-1.7 4.8-9.2 9.4-9.2 9.4Z" />
  </Svg>
);
export const VolumeIcon = ({ muted, ...p }: IconProps & { muted?: boolean }) => (
  <Svg {...p}>
    <path d="M4 9.5v5a1 1 0 0 0 1 1h3l4.4 3.7a1 1 0 0 0 1.6-.8V5.6a1 1 0 0 0-1.6-.8L8 8.5H5a1 1 0 0 0-1 1Z" />
    {muted ? (
      <path d="m16.5 9.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    ) : (
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    )}
  </Svg>
);
export const SearchIcon = (p: IconProps) => (
  <Svg {...p} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
);
export const YoutubeIcon = (p: IconProps) => (
  <Svg {...p}><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" /></Svg>
);
export const MusicIcon = (p: IconProps) => (
  <Svg {...p}><path d="M9 17.5V6.3a1 1 0 0 1 .78-.97l9-2A1 1 0 0 1 20 4.3v11.2a3 3 0 1 1-2-2.83V7.5l-7 1.56v8.44a3 3 0 1 1-2-2.83Z" /></Svg>
);

const Stroke = ({ children, ...props }: IconProps) => (
  <Svg fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    {children}
  </Svg>
);

export const PlaylistAddIcon = (p: IconProps) => <Stroke {...p}><path d="M4 6h11M4 11h11M4 16h7M18 13v8M14 17h8" /></Stroke>;
export const PlaylistIcon = (p: IconProps) => <Stroke {...p}><path d="M4 6h12M4 11h12M4 16h7" /><circle cx="17" cy="17" r="3" /><path d="M20 17V7l2 1" /></Stroke>;
export const HistoryIcon = (p: IconProps) => <Stroke {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></Stroke>;
export const ShuffleIcon = (p: IconProps) => <Stroke {...p}><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></Stroke>;
export const TrashIcon = (p: IconProps) => <Stroke {...p}><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" /></Stroke>;
export const CloseIcon = (p: IconProps) => <Stroke {...p}><path d="M6 6l12 12M18 6 6 18" /></Stroke>;
export const CheckIcon = (p: IconProps) => <Stroke {...p}><path d="m5 12 5 5L20 7" /></Stroke>;
export const PlusIcon = (p: IconProps) => <Stroke {...p}><path d="M12 5v14M5 12h14" /></Stroke>;
export const ArrowUpIcon = (p: IconProps) => <Stroke {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Stroke>;
export const ArrowDownIcon = (p: IconProps) => <Stroke {...p}><path d="M12 5v14M6 13l6 6 6-6" /></Stroke>;
export const GamepadIcon = (p: IconProps) => <Stroke {...p}><path d="M6 9h4M8 7v4M15 10h.01M18 8h.01" /><path d="M7.5 4h9A4.5 4.5 0 0 1 21 8.5v5.8a2.7 2.7 0 0 1-4.8 1.7L14.5 14h-5l-1.7 2a2.7 2.7 0 0 1-4.8-1.7V8.5A4.5 4.5 0 0 1 7.5 4Z" /></Stroke>;
export const TrophyIcon = (p: IconProps) => <Stroke {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M9 17h6v3H9z" /></Stroke>;
export const EditIcon = (p: IconProps) => <Stroke {...p}><path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" /></Stroke>;

/** Petit égaliseur animé affiché sur la piste en cours de lecture */
export function EqBars({ active = true }: { active?: boolean }) {
  return (
    <span className={`eq ${active ? "eq--active" : ""}`} aria-hidden="true">
      <span /><span /><span /><span />
    </span>
  );
}
