import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import CoverArt from "../components/CoverArt";
import type { Anime } from "../types";

export default function Animes() {
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.animes().then(setAnimes).catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{animes.length} animes</p>
          <h1>
            Parcourir par <span className="gradient-text">anime</span>
          </h1>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      <div className="music-grid">
        {animes.map((anime) => (
          <Link key={anime.id} to={`/animes/${anime.id}`} className="music-card">
            <div className="music-card__art">
              <CoverArt src={anime.image_url} label={anime.title} className="music-card__img" />
              <div className="music-card__scrim" aria-hidden="true" />
              <span className="music-card__badge">{anime.year}</span>
            </div>
            <div className="music-card__body">
              <h3 className="music-card__title gradient-text">{anime.title}</h3>
              <p className="music-card__artist">{anime.studio}</p>
              <div className="music-card__meta">
                <span className="music-card__tag">{anime.ost_count} titre{anime.ost_count > 1 ? "s" : ""}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
