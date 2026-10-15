import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { PlayIcon, PlusIcon } from "../components/Icons";
import PlaylistCover from "../components/PlaylistCover";
import { useLibrary } from "../library";
import { usePlayer } from "../player";
import { isPlayable, type PlaylistSummary } from "../types";

export default function Playlists() {
  const { playlists, createPlaylist } = useLibrary();
  const player = usePlayer();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const playlist = await createPlaylist(name.trim());
      setName("");
      navigate(`/playlists/${playlist.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Le résumé ne contient que l'aperçu : on charge la playlist complète avant de la lancer
  const playAll = async (summary: PlaylistSummary) => {
    const playlist = await api.playlist(summary.id);
    const first = playlist.osts.find(isPlayable);
    if (first) player.play(first, playlist.osts);
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Ta bibliothèque · {playlists.length} playlist{playlists.length > 1 ? "s" : ""}</p>
          <h1>
            Mes <span className="gradient-text">playlists</span>
          </h1>
          <p className="muted">Range tes OST comme tu veux : par anime, par ambiance, pour réviser…</p>
        </div>
      </header>

      <div className="music-grid">
        <form className="playlist-card playlist-card--new" onSubmit={create}>
          <div className="playlist-card__art playlist-card__art--new"><PlusIcon /></div>
          <label htmlFor="new-playlist-name" className="playlist-card__name">Nouvelle playlist</label>
          <input
            id="new-playlist-name"
            placeholder="Nom, ex. « Openings cultes »"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-sm" disabled={!name.trim()}>Créer</button>
          {error && <p className="error">{error}</p>}
        </form>

        {playlists.map((p) => (
          <article key={p.id} className="playlist-card">
            <div className="playlist-card__art-wrap">
              <Link to={`/playlists/${p.id}`} className="playlist-card__art" aria-label={`Ouvrir ${p.name}`}>
                <PlaylistCover preview={p.preview} />
              </Link>
              {p.ost_count > 0 && (
                <button className="music-card__play music-card__play--visible playlist-card__play" title={`Lire ${p.name}`} onClick={() => playAll(p)}>
                  <PlayIcon style={{ marginLeft: 2 }} />
                </button>
              )}
            </div>
            <Link to={`/playlists/${p.id}`} className="playlist-card__name">{p.name}</Link>
            <p className="muted playlist-card__count">{p.ost_count} titre{p.ost_count > 1 ? "s" : ""}</p>
          </article>
        ))}
      </div>
    </>
  );
}
