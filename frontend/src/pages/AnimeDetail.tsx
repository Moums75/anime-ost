import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { PlayIcon } from "../components/Icons";
import MusicGrid, { replaceOst } from "../components/MusicGrid";
import { usePlayer } from "../player";
import { isPlayable, type AnimeDetail as AnimeDetailType } from "../types";

export default function AnimeDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const player = usePlayer();
  const [anime, setAnime] = useState<AnimeDetailType | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.anime(id).then(setAnime).catch((e) => setError(e.message));
  }, [id, user]);

  if (error) return <p className="error">{error}</p>;
  if (!anime) return <p className="muted">Chargement…</p>;

  const firstPlayable = anime.osts.find(isPlayable);

  return (
    <>
      <Link to="/animes" className="back-link">← Tous les animes</Link>
      <header className="page-head">
        <div>
          <p className="eyebrow">{anime.studio} · {anime.year}</p>
          <h1 className="gradient-text">{anime.title}</h1>
          <p className="muted">{anime.osts.length} titre{anime.osts.length > 1 ? "s" : ""}</p>
        </div>
        {firstPlayable && (
          <button className="btn btn-lg" onClick={() => player.play(firstPlayable, anime.osts)}>
            <PlayIcon /> Tout écouter
          </button>
        )}
      </header>
      <MusicGrid
        osts={anime.osts}
        onChange={(o) => setAnime((a) => (a ? { ...a, osts: replaceOst(a.osts, o) } : a))}
        empty="Pas encore d'OST pour cet anime."
      />
    </>
  );
}
