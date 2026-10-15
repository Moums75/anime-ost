import type { Ost } from "../types";
import CoverArt from "./CoverArt";
import { PlaylistIcon } from "./Icons";

/** Mosaïque des pochettes des premières OST d'une playlist (comme sur les apps de streaming). */
export default function PlaylistCover({ preview, className = "" }: { preview: Ost[]; className?: string }) {
  if (preview.length === 0) {
    return (
      <div className={`playlist-cover playlist-cover--empty ${className}`}>
        <PlaylistIcon />
      </div>
    );
  }
  // Moins de 4 titres : une seule grande pochette plutôt qu'une mosaïque à trous
  const tiles = preview.length >= 4 ? preview.slice(0, 4) : preview.slice(0, 1);
  return (
    <div className={`playlist-cover ${tiles.length === 4 ? "playlist-cover--grid" : ""} ${className}`}>
      {tiles.map((ost) => (
        <CoverArt key={ost.id} src={ost.cover_url} label={ost.anime_title} />
      ))}
    </div>
  );
}
