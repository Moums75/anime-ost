import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import CoverArt from "../components/CoverArt";
import { SearchIcon } from "../components/Icons";
import { KIND_LABELS, type Anime, type Kind, type MediaKind, type Ost } from "../types";

const emptyAnime = { title: "", studio: "", year: new Date().getFullYear(), mal_id: null as number | null };
const emptyOst = { title: "", artist: "", kind: "opening" as Kind, youtube_url: "", anime_id: 0 };

type Message = { text: string; error?: boolean } | null;

function OstRow({ ost, onChange, onDelete, notify }: {
  ost: Ost;
  onChange: (ost: Ost) => void;
  onDelete: (id: number) => void;
  notify: (m: Message) => void;
}) {
  const [busy, setBusy] = useState<MediaKind | "delete" | null>(null);

  const upload = async (kind: MediaKind, file?: File) => {
    if (!file) return;
    setBusy(kind);
    try {
      onChange(await api.uploadMedia(ost.id, kind, file));
      notify({ text: `${kind === "audio" ? "Audio" : "Pochette"} de « ${ost.title} » mis à jour ✔` });
    } catch (err) {
      notify({ text: (err as Error).message, error: true });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirm(`Supprimer « ${ost.title} » ?`)) return;
    setBusy("delete");
    try {
      await api.deleteOst(ost.id);
      onDelete(ost.id);
    } catch (err) {
      notify({ text: (err as Error).message, error: true });
      setBusy(null);
    }
  };

  return (
    <li className="admin-row">
      <div className="admin-row__cover">
        <CoverArt src={ost.cover_url} label={ost.anime_title} />
      </div>
      <div className="admin-row__info">
        <strong>{ost.title}</strong>
        <span className="muted">{ost.artist} · {ost.anime_title}</span>
      </div>
      <span className={`status ${ost.audio_url ? "status--ok" : ost.youtube_id ? "status--yt" : ""}`}>
        {ost.audio_url ? "Audio ✔" : ost.youtube_id ? "YouTube" : "Lien seul"}
      </span>
      <div className="admin-row__actions">
        <label className="btn btn-ghost btn-sm">
          {busy === "audio" ? "Envoi…" : ost.audio_url ? "Remplacer audio" : "Ajouter audio"}
          <input type="file" accept="audio/*" hidden disabled={busy !== null} onChange={(e) => upload("audio", e.target.files?.[0])} />
        </label>
        <label className="btn btn-ghost btn-sm">
          {busy === "cover" ? "Envoi…" : "Pochette"}
          <input type="file" accept="image/*" hidden disabled={busy !== null} onChange={(e) => upload("cover", e.target.files?.[0])} />
        </label>
        <button className="btn btn-danger btn-sm" onClick={remove} disabled={busy !== null}>Supprimer</button>
      </div>
    </li>
  );
}

export default function Admin() {
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [osts, setOsts] = useState<Ost[]>([]);
  const [search, setSearch] = useState("");
  const [anime, setAnime] = useState(emptyAnime);
  const [ost, setOst] = useState(emptyOst);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [formKey, setFormKey] = useState(0); // pour vider les <input type="file">
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const reloadAnimes = () => api.animes().then(setAnimes);
  const reloadOsts = (q = search) => api.osts({ q, limit: 200 }).then((p) => setOsts(p.items));

  useEffect(() => {
    reloadAnimes();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => reloadOsts(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const fail = (err: unknown) => setMessage({ text: (err as Error).message, error: true });

  const addAnime = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.createAnime(anime);
      setAnime(emptyAnime);
      setMessage({ text: "Anime ajouté ✔" });
      await reloadAnimes();
    } catch (err) {
      fail(err);
    }
  };

  const addOst = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await api.createOst(ost);
      if (audioFile) await api.uploadMedia(created.id, "audio", audioFile);
      if (coverFile) await api.uploadMedia(created.id, "cover", coverFile);
      setOst({ ...emptyOst, anime_id: ost.anime_id });
      setAudioFile(null);
      setCoverFile(null);
      setFormKey((k) => k + 1);
      setMessage({ text: `« ${created.title} » ajoutée ✔` });
      await Promise.all([reloadAnimes(), reloadOsts()]);
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  const deleteAnime = async (a: Anime) => {
    if (!confirm(`Supprimer « ${a.title} » et toutes ses OST ?`)) return;
    try {
      await api.deleteAnime(a.id);
      setMessage({ text: "Anime supprimé" });
      await Promise.all([reloadAnimes(), reloadOsts()]);
    } catch (err) {
      fail(err);
    }
  };

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Espace administrateur</p>
          <h1>
            Gérer le <span className="gradient-text">catalogue</span>
          </h1>
        </div>
      </header>
      {message && <p className={`notice ${message.error ? "notice--error" : ""}`}>{message.text}</p>}

      <div className="admin-grid">
        <form className="panel form" onSubmit={addAnime}>
          <h2>Ajouter un anime</h2>
          <input placeholder="Titre" value={anime.title} onChange={(e) => setAnime({ ...anime, title: e.target.value })} required />
          <input placeholder="Studio" value={anime.studio} onChange={(e) => setAnime({ ...anime, studio: e.target.value })} required />
          <input type="number" placeholder="Année" value={anime.year} onChange={(e) => setAnime({ ...anime, year: Number(e.target.value) })} required />
          <input
            type="number"
            min={1}
            placeholder="ID MyAnimeList (facultatif, pour la pochette)"
            value={anime.mal_id ?? ""}
            onChange={(e) => setAnime({ ...anime, mal_id: e.target.value ? Number(e.target.value) : null })}
          />
          <p className="hint">Sans ID, la pochette est cherchée automatiquement sur AniList à partir du titre.</p>
          <button className="btn">Ajouter</button>
        </form>

        <form className="panel form" onSubmit={addOst} key={formKey}>
          <h2>Ajouter une OST</h2>
          <select value={ost.anime_id || ""} onChange={(e) => setOst({ ...ost, anime_id: Number(e.target.value) })} required>
            <option value="">Choisir un anime…</option>
            {animes.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
          <input placeholder="Titre" value={ost.title} onChange={(e) => setOst({ ...ost, title: e.target.value })} required />
          <input placeholder="Artiste / compositeur" value={ost.artist} onChange={(e) => setOst({ ...ost, artist: e.target.value })} required />
          <select value={ost.kind} onChange={(e) => setOst({ ...ost, kind: e.target.value as Kind })}>
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input type="url" placeholder="Lien de la vidéo YouTube officielle (youtube.com/watch?v=…)" value={ost.youtube_url} onChange={(e) => setOst({ ...ost, youtube_url: e.target.value })} required />
          <label className="file-field">
            <span>Fichier audio (mp3, m4a, ogg…)</span>
            <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)} />
          </label>
          <label className="file-field">
            <span>Pochette (jpg, png, webp)</span>
            <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
          </label>
          <button className="btn" disabled={saving}>{saving ? "Envoi en cours…" : "Ajouter"}</button>
        </form>
      </div>

      <section className="panel">
        <div className="section-head">
          <h2>OST ({osts.length})</h2>
          <label className="search search--sm">
            <SearchIcon />
            <input placeholder="Filtrer…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
        </div>
        <ul className="admin-list">
          {osts.map((o) => (
            <OstRow
              key={o.id}
              ost={o}
              notify={setMessage}
              onChange={(updated) => setOsts((l) => l.map((x) => (x.id === updated.id ? updated : x)))}
              onDelete={(id) => {
                setOsts((l) => l.filter((x) => x.id !== id));
                reloadAnimes();
              }}
            />
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Animes ({animes.length})</h2>
        <ul className="admin-list">
          {animes.map((a) => (
            <li key={a.id} className="admin-row">
              <div className="admin-row__info">
                <strong>{a.title}</strong>
                <span className="muted">{a.studio} · {a.year} · {a.ost_count} OST</span>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => deleteAnime(a)}>Supprimer</button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
