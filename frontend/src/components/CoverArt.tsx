import type { CSSProperties } from "react";

/** Teinte stable dérivée du nom de l'anime, pour que chaque anime ait "sa" couleur. */
function hueOf(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

function initials(text: string): string {
  return text
    .split(/[\s:-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

interface Props {
  src: string | null;
  label: string;
  className?: string;
}

/** Pochette de l'OST, ou dégradé avec initiales si aucune image n'a été envoyée. */
export default function CoverArt({ src, label, className = "" }: Props) {
  if (src) {
    return <img src={src} alt="" className={className} loading="lazy" decoding="async" draggable={false} />;
  }
  return (
    <div className={`cover-fallback ${className}`} style={{ "--hue": hueOf(label) } as CSSProperties}>
      <span>{initials(label)}</span>
    </div>
  );
}
