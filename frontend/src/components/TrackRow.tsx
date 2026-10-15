import type { KeyboardEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "../player";
import { isPlayable, KIND_LABELS, type Ost } from "../types";
import AddToPlaylist from "./AddToPlaylist";
import CoverArt from "./CoverArt";
import { EqBars, PlayIcon, YoutubeIcon } from "./Icons";

interface Props {
  ost: Ost;
  /** File de lecture quand on clique sur la ligne */
  queue: Ost[];
  /** Info à droite du titre (heure d'écoute, numéro…) */
  meta?: ReactNode;
  /** Boutons propres à la page (retirer, monter, descendre…) */
  actions?: ReactNode;
}

/** Ligne de titre compacte, utilisée pour l'historique et le contenu des playlists. */
export default function TrackRow({ ost, queue, meta, actions }: Props) {
  const player = usePlayer();
  const isCurrent = player.current?.id === ost.id;
  const playable = isPlayable(ost);

  const activate = () => {
    if (playable) player.play(ost, queue);
    else window.open(ost.youtube_url, "_blank", "noopener");
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return; // touches tapées dans un bouton de la ligne
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  };

  return (
    <li
      className={`track-row ${isCurrent ? "track-row--current" : ""}`}
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={onKeyDown}
      aria-label={`${playable ? "Écouter" : "Ouvrir sur YouTube"} ${ost.title}`}
    >
      <div className="track-row__cover">
        <CoverArt src={ost.cover_url} label={ost.anime_title} />
        <span className="track-row__play" aria-hidden="true">
          {!playable ? <YoutubeIcon /> : isCurrent && player.playing ? <EqBars /> : <PlayIcon />}
        </span>
      </div>
      <div className="track-row__info">
        <span className="track-row__title">{ost.title}</span>
        <span className="track-row__sub">
          {ost.artist} ·{" "}
          <Link to={`/animes/${ost.anime_id}`} onClick={(e) => e.stopPropagation()}>{ost.anime_title}</Link>
        </span>
      </div>
      <span className="track-row__kind">{KIND_LABELS[ost.kind]}</span>
      {meta && <span className="track-row__meta">{meta}</span>}
      <div className="track-row__actions" onClick={(e) => e.stopPropagation()}>
        <AddToPlaylist ost={ost} />
        {actions}
      </div>
    </li>
  );
}
