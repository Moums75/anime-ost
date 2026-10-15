import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, EditIcon, PlayIcon, ShuffleIcon, TrashIcon } from "../components/Icons";
import PlaylistCover from "../components/PlaylistCover";
import TrackRow from "../components/TrackRow";
import { useLibrary } from "../library";
import { usePlayer } from "../player";
import { isPlayable, type Ost, type PlaylistDetail as Detail } from "../types";

/** Mélange de Fisher-Yates (copie, ne modifie pas la liste d'origine) */
function shuffled<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function PlaylistDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const player = usePlayer();
  const library = useLibrary();
  const [playlist, setPlaylist] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  // Recharge aussi quand la playlist est modifiée depuis un menu « Ajouter à une playlist »
  useEffect(() => {
    api.playlist(id).then(setPlaylist).catch((e) => setError(e.message));
  }, [id, library.version]);

  if (error) return <p className="error">{error}</p>;
  if (!playlist) return <p className="muted">Chargement…</p>;

  const osts = playlist.osts;
  const playFrom = (list: Ost[]) => {
    const first = list.find(isPlayable);
    if (first) player.play(first, list);
  };

  const update = async (action: () => Promise<Detail | unknown>) => {
    try {
      await action();
      setPlaylist(await api.playlist(playlist.id));
      await library.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const move = (index: number, delta: number) => {
    const ids = osts.map((o) => o.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    // Mise à jour immédiate à l'écran, puis enregistrement
    setPlaylist({ ...playlist, osts: ids.map((oid) => osts.find((o) => o.id === oid)!) });
    update(() => api.reorderPlaylist(playlist.id, ids));
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    update(() => api.updatePlaylist(playlist.id, form)).then(() => setEditing(false));
  };

  const remove = async () => {
    if (!confirm(`Supprimer la playlist « ${playlist.name} » ?`)) return;
    await api.deletePlaylist(playlist.id);
    await library.refresh();
    navigate("/playlists");
  };

  return (
    <>
      <Link to="/playlists" className="back-link">← Mes playlists</Link>
      <header className="playlist-head">
        <PlaylistCover preview={playlist.preview} className="playlist-head__cover" />
        <div className="playlist-head__info">
          <p className="eyebrow">Playlist · {osts.length} titre{osts.length > 1 ? "s" : ""}</p>
          {editing ? (
            <form className="playlist-edit" onSubmit={save}>
              <input
                id="playlist-name"
                aria-label="Nom de la playlist"
                value={form.name}
                maxLength={80}
                required
                autoFocus
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                id="playlist-description"
                aria-label="Description"
                placeholder="Description (facultatif)"
                value={form.description}
                maxLength={300}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <div className="page-actions">
                <button className="btn btn-sm">Enregistrer</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Annuler</button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="gradient-text">{playlist.name}</h1>
              {playlist.description && <p className="muted">{playlist.description}</p>}
            </>
          )}
          {!editing && (
            <div className="page-actions">
              <button className="btn btn-lg" disabled={!osts.some(isPlayable)} onClick={() => playFrom(osts)}>
                <PlayIcon /> Lire
              </button>
              <button className="btn btn-ghost" disabled={!osts.some(isPlayable)} onClick={() => playFrom(shuffled(osts))}>
                <ShuffleIcon /> Aléatoire
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setForm({ name: playlist.name, description: playlist.description });
                  setEditing(true);
                }}
              >
                <EditIcon /> Modifier
              </button>
              <button className="btn btn-danger" onClick={remove}>
                <TrashIcon /> Supprimer
              </button>
            </div>
          )}
        </div>
      </header>

      {osts.length === 0 ? (
        <div className="empty-state">
          <p>Cette playlist est vide. Ajoute des OST avec le bouton « Ajouter à une playlist » sur les cartes ou dans le lecteur.</p>
          <Link to="/musiques" className="btn">Parcourir les musiques</Link>
        </div>
      ) : (
        <ul className="track-list">
          {osts.map((ost, i) => (
            <TrackRow
              key={ost.id}
              ost={ost}
              queue={osts}
              meta={String(i + 1).padStart(2, "0")}
              actions={
                <>
                  <button className="icon-btn" title="Monter" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUpIcon />
                  </button>
                  <button className="icon-btn" title="Descendre" disabled={i === osts.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDownIcon />
                  </button>
                  <button
                    className="icon-btn"
                    title="Retirer de la playlist"
                    onClick={() => update(() => api.removeFromPlaylist(playlist.id, ost.id))}
                  >
                    <CloseIcon />
                  </button>
                </>
              }
            />
          ))}
        </ul>
      )}
    </>
  );
}
