import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { PlayIcon } from "../components/Icons";
import MusicGrid, { replaceOst } from "../components/MusicGrid";
import { HISTORY_EVENT } from "../library";
import { usePlayer } from "../player";
import { isPlayable, type Anime, type Ost } from "../types";

export default function Home() {
  const { user } = useAuth();
  const player = usePlayer();
  const [osts, setOsts] = useState<Ost[]>([]);
  const [total, setTotal] = useState(0);
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [recent, setRecent] = useState<Ost[]>([]);
  const [error, setError] = useState("");

  // « Écoutés récemment » : les 6 dernières OST distinctes de l'historique (connecté uniquement)
  const loadRecent = useCallback(() => {
    if (!user) return setRecent([]);
    api
      .history(30)
      .then((page) => setRecent([...new Map(page.items.map((e) => [e.ost.id, e.ost])).values()].slice(0, 6)))
      .catch(() => setRecent([]));
  }, [user]);

  useEffect(() => {
    loadRecent();
    window.addEventListener(HISTORY_EVENT, loadRecent);
    return () => window.removeEventListener(HISTORY_EVENT, loadRecent);
  }, [loadRecent]);

  useEffect(() => {
    api.animes().then(setAnimes).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    api
      .osts({ limit: 12 })
      .then((page) => {
        setOsts(page.items);
        setTotal(page.total);
      })
      .catch((e) => setError(e.message));
  }, [user]);

  const firstPlayable = osts.find(isPlayable);
  const studios = new Set(animes.map((a) => a.studio)).size;

  return (
    <>
      <section className="hero">
        <div className="hero__glow" aria-hidden="true" />
        <p className="eyebrow">Streaming d'OST d'anime</p>
        <h1 className="hero__title">
          Toute la musique de tes <span className="gradient-text">animes préférés</span>
        </h1>
        <p className="hero__text">
          Openings, endings, bandes originales et insert songs. Cherche, découvre, appuie sur play.
        </p>
        <div className="hero__actions">
          {firstPlayable ? (
            <button className="btn btn-lg" onClick={() => player.play(firstPlayable, osts)}>
              <PlayIcon /> Lancer la lecture
            </button>
          ) : null}
          <Link to="/musiques" className={`btn btn-lg ${firstPlayable ? "btn-ghost" : ""}`}>
            Parcourir le catalogue
          </Link>
        </div>
        <div className="stats">
          <div className="stat"><strong>{total}</strong><span>Titres</span></div>
          <div className="stat"><strong>{animes.length}</strong><span>Animes</span></div>
          <div className="stat"><strong>{studios}</strong><span>Studios</span></div>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="home-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Ton historique</p>
              <h2>Écoutés <span className="gradient-text">récemment</span></h2>
            </div>
            <Link to="/historique" className="btn btn-ghost btn-sm">Tout l'historique →</Link>
          </div>
          <MusicGrid osts={recent} onChange={(o) => setRecent((l) => replaceOst(l, o))} empty="" />
        </section>
      )}

      <section>
        <div className="section-head">
          <div>
            <p className="eyebrow">Sélection</p>
            <h2>Ajouts <span className="gradient-text">récents</span></h2>
          </div>
          <Link to="/musiques" className="btn btn-ghost btn-sm">Tout voir →</Link>
        </div>
        {error && <p className="error">{error}</p>}
        <MusicGrid osts={osts} onChange={(o) => setOsts((l) => replaceOst(l, o))} empty="Aucune OST pour le moment." />
      </section>
    </>
  );
}
