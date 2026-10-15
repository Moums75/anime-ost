import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { usePlayer } from "../player";
import { isPlayable, KIND_LABELS, type Ost } from "../types";
import AddToPlaylist from "./AddToPlaylist";
import CoverArt from "./CoverArt";
import { EqBars, HeartIcon, PlayIcon, YoutubeIcon } from "./Icons";

interface Props {
  ost: Ost;
  number: number;
  /** File de lecture utilisée quand on clique sur cette carte */
  queue: Ost[];
  onChange?: (ost: Ost) => void;
}

export default function MusicCard({ ost, number, queue, onChange }: Props) {
  const { user } = useAuth();
  const player = usePlayer();
  const [busy, setBusy] = useState(false);
  const isCurrent = player.current?.id === ost.id;
  const isPlaying = isCurrent && player.playing;
  const playable = isPlayable(ost);

  // Jouable sur le site (fichier audio ou vidéo YouTube intégrée), sinon on ouvre le lien YouTube
  const activate = () => {
    if (playable) player.play(ost, queue);
    else window.open(ost.youtube_url, "_blank", "noopener");
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  };

  const toggleFavorite = async (e: MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      if (ost.favorite) await api.removeFavorite(ost.id);
      else await api.addFavorite(ost.id);
      onChange?.({ ...ost, favorite: !ost.favorite });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      className={`music-card ${isCurrent ? "active" : ""}`}
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={onKeyDown}
      aria-label={`${playable ? (isPlaying ? "Pause" : "Écouter") : "Ouvrir sur YouTube"} ${ost.title}`}
    >
      <div className="music-card__art">
        <CoverArt src={ost.cover_url} label={ost.anime_title} className="music-card__img" />
        <div className="music-card__scrim" aria-hidden="true" />
        <span className={`music-card__badge ${isCurrent ? "music-card__badge--active" : ""}`}>
          {String(number).padStart(2, "0")}
        </span>
        {user && (
          <button
            type="button"
            className={`music-card__action ${ost.favorite ? "music-card__action--on" : ""}`}
            onClick={toggleFavorite}
            disabled={busy}
            title={ost.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            aria-pressed={ost.favorite}
          >
            <HeartIcon filled={ost.favorite} />
          </button>
        )}
        <AddToPlaylist ost={ost} className="music-card__action music-card__action--playlist" />
        <div className={`music-card__play ${isCurrent ? "music-card__play--visible" : ""} ${playable ? "" : "music-card__play--yt"}`} aria-hidden="true">
          {!playable ? <YoutubeIcon /> : isPlaying ? <EqBars /> : <PlayIcon style={{ marginLeft: 2 }} />}
        </div>
      </div>
      <div className="music-card__body">
        <h3 className="music-card__title gradient-text" title={ost.title}>{ost.title}</h3>
        <p className="music-card__artist">{ost.artist}</p>
        <div className="music-card__meta">
          <span className={`music-card__tag ${isPlaying ? "music-card__tag--live" : ""}`}>
            {isPlaying ? "En lecture" : KIND_LABELS[ost.kind]}
          </span>
          <Link to={`/animes/${ost.anime_id}`} className="music-card__anime" onClick={(e) => e.stopPropagation()} title={ost.anime_title}>
            {ost.anime_title}
          </Link>
        </div>
      </div>
    </article>
  );
}
