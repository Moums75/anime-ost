import { useEffect, useState, type ChangeEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { SearchIcon } from "../components/Icons";
import MusicGrid, { replaceOst } from "../components/MusicGrid";
import { KIND_LABELS, type Anime, type Ost, type OstFilters } from "../types";

const PAGE_SIZE = 24;

export default function MusicList() {
  const { user } = useAuth();
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [osts, setOsts] = useState<Ost[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<OstFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.animes().then(setAnimes).catch((e) => setError(e.message));
  }, []);

  // Recharge la 1re page quand les filtres changent (avec un petit délai pendant la frappe)
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .osts({ ...filters, limit: PAGE_SIZE })
        .then((page) => {
          setOsts(page.items);
          setTotal(page.total);
          setError("");
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [filters, user]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const page = await api.osts({ ...filters, limit: PAGE_SIZE, offset: osts.length });
      setOsts((list) => [...list, ...page.items]);
      setTotal(page.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const update = (key: keyof OstFilters) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));

  const progress = total > 0 ? (osts.length / total) * 100 : 0;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Catalogue complet · {total} titres</p>
          <h1>
            Liste des <span className="gradient-text">musiques</span>
          </h1>
          <p className="muted">Toute la collection en un seul scroll. Cherche, découvre, appuie sur play.</p>
        </div>
        <div className="counter">
          <span className="counter__status">{loading ? "Chargement" : "Chargé"}</span>
          <strong>
            {osts.length} <span>/ {total}</span>
          </strong>
          <div className="counter__bar"><div style={{ width: `${progress}%` }} /></div>
        </div>
      </header>

      <div className="filters">
        <label className="search">
          <SearchIcon />
          <input placeholder="Titre, artiste ou anime…" value={filters.q ?? ""} onChange={update("q")} />
        </label>
        <select value={filters.anime_id ?? ""} onChange={update("anime_id")}>
          <option value="">Tous les animes</option>
          {animes.map((a) => (
            <option key={a.id} value={a.id}>{a.title}</option>
          ))}
        </select>
        <select value={filters.kind ?? ""} onChange={update("kind")}>
          <option value="">Tous les types</option>
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      <MusicGrid
        osts={osts}
        onChange={(o) => setOsts((l) => replaceOst(l, o))}
        empty={loading ? "Chargement…" : "Aucune OST ne correspond à ta recherche."}
      />

      {osts.length > 0 && (
        <div className="load-more">
          <p className="muted">{osts.length} sur {total} titres</p>
          {osts.length < total && (
            <button className="btn btn-ghost" onClick={loadMore} disabled={loading}>
              {loading ? "Chargement…" : "Charger plus de titres"}
            </button>
          )}
        </div>
      )}
    </>
  );
}
