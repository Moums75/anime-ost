import { useRef, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "../player";
import AddToPlaylist from "./AddToPlaylist";
import CoverArt from "./CoverArt";
import { EqBars, GamepadIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, VolumeIcon } from "./Icons";
import Mascots from "./Mascots";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Remplissage en dégradé de la partie "déjà jouée" d'un slider */
const fill = (value: number, max: number) => ({ "--fill": `${max > 0 ? (value / max) * 100 : 0}%` }) as CSSProperties;

export default function PlayerBar() {
  const p = usePlayer();
  const volumeBeforeMute = useRef(0.8);
  if (!p.current) return null;
  const ost = p.current;

  const toggleMute = () => {
    if (p.volume > 0) {
      volumeBeforeMute.current = p.volume;
      p.setVolume(0);
    } else {
      p.setVolume(volumeBeforeMute.current || 0.8);
    }
  };

  return (
    <>
      <Mascots playing={p.playing} />
      <div className="player-shell" role="region" aria-label="Lecteur audio">
        <div className="player-ambient" aria-hidden="true">
          <CoverArt src={ost.cover_url} label={ost.anime_title} />
        </div>

        <div className="player">
          <div className="player__track">
            <div className="player__cover">
              <CoverArt src={ost.cover_url} label={ost.anime_title} />
            </div>
            <div className="player__info">
              <p className="player__title gradient-text" title={ost.title}>{ost.title}</p>
              <p className="player__artist">
                {p.source === "youtube" && <span className="source-tag" title="Vidéo officielle lue via YouTube">YouTube</span>}
                {ost.artist} · <Link to={`/animes/${ost.anime_id}`}>{ost.anime_title}</Link>
              </p>
            </div>
            <EqBars active={p.playing} />
            <AddToPlaylist ost={ost} />
            <Link to={`/jeu?ost=${ost.id}`} className="icon-btn" title="Jouer à OST Rush sur ce titre">
              <GamepadIcon />
            </Link>
          </div>

          <div className="player__center">
            <div className="player__controls">
              <button className="icon-btn" onClick={p.prev} title="Précédent"><PrevIcon /></button>
              <button className="play-btn" onClick={p.toggle} title={p.playing ? "Pause" : "Lecture"}>
                {p.playing ? <PauseIcon /> : <PlayIcon style={{ marginLeft: 2 }} />}
              </button>
              <button className="icon-btn" onClick={p.next} disabled={!p.hasNext} title="Suivant"><NextIcon /></button>
            </div>
            <div className="player__progress">
              <span>{formatTime(p.currentTime)}</span>
              <input
                type="range"
                className="slider"
                min={0}
                max={p.duration || 0}
                step={0.1}
                value={Math.min(p.currentTime, p.duration || 0)}
                onChange={(e) => p.seek(Number(e.target.value))}
                style={fill(p.currentTime, p.duration)}
                aria-label="Position dans le morceau"
              />
              <span>
                {p.error ? (
                  <a className="error" href={ost.youtube_url} target="_blank" rel="noreferrer" title="Ouvrir sur YouTube">
                    {p.error} ↗
                  </a>
                ) : (
                  formatTime(p.duration)
                )}
              </span>
            </div>
          </div>

          <div className="player__volume">
            <button className="icon-btn" onClick={toggleMute} title={p.volume > 0 ? "Couper le son" : "Activer le son"}>
              <VolumeIcon muted={p.volume === 0} />
            </button>
            <input
              type="range"
              className="slider"
              min={0}
              max={1}
              step={0.01}
              value={p.volume}
              onChange={(e) => p.setVolume(Number(e.target.value))}
              style={fill(p.volume, 1)}
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </>
  );
}
