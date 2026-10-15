import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import CoverArt from "../components/CoverArt";
import { PlayIcon } from "../components/Icons";
import { DIFFICULTIES, type Difficulty } from "../game/chart";
import { isPlayable, type MyScore, type Ost, type PlayerRanking, type RankedScore } from "../types";

const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const isDifficulty = (v: string | null): v is Difficulty => v === "easy" || v === "normal" || v === "hard";
const ordinal = (n: number) => (n === 1 ? "1er" : `${n}e`);

export default function Leaderboards() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [players, setPlayers] = useState<PlayerRanking[]>([]);
  const [osts, setOsts] = useState<Ost[]>([]);
  const [board, setBoard] = useState<RankedScore[] | null>(null);
  const [mine, setMine] = useState<MyScore[]>([]);
  const [error, setError] = useState("");

  const ostId = Number(params.get("ost")) || null;
  const difficulty: Difficulty = isDifficulty(params.get("difficulty")) ? (params.get("difficulty") as Difficulty) : "normal";
  const select = (changes: Record<string, string>) => setParams({ ...Object.fromEntries(params), ...changes }, { replace: true });

  useEffect(() => {
    api.players(20).then(setPlayers).catch((e) => setError(e.message));
    api.osts({ limit: 200 }).then((page) => setOsts(page.items.filter(isPlayable))).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (user) api.myScores().then(setMine).catch(() => setMine([]));
    else setMine([]);
  }, [user]);

  // Par défaut, le classement du premier titre de la liste
  const currentId = ostId ?? osts[0]?.id ?? null;
  useEffect(() => {
    if (!currentId) return;
    setBoard(null);
    api.leaderboard(currentId, difficulty, 20).then(setBoard).catch((e) => setError(e.message));
  }, [currentId, difficulty, user]);

  const current = osts.find((o) => o.id === currentId);

  return (
    <>
      <Link to="/jeu" className="back-link">← OST Rush</Link>
      <header className="page-head">
        <div>
          <p className="eyebrow">Mini-jeu OST Rush</p>
          <h1>
            <span className="gradient-text">Classements</span>
          </h1>
          <p className="muted">Le meilleur score de chaque joueur, enregistré à la fin de chaque partie (compte connecté).</p>
        </div>
        <Link to="/jeu" className="btn btn-lg"><PlayIcon /> Jouer</Link>
      </header>
      {error && <p className="error">{error}</p>}

      <div className="lb-grid">
        <section className="lb-panel" aria-labelledby="lb-players">
          <h2 id="lb-players">Meilleurs joueurs</h2>
          <p className="muted lb-hint">Total des meilleurs scores, tous titres et niveaux confondus.</p>
          {players.length === 0 ? (
            <p className="empty">Personne n'a encore joué. À toi d'ouvrir le bal !</p>
          ) : (
            <ol className="lb-list">
              {players.map((p) => (
                <li key={p.user_id} className={`lb-row ${p.me ? "is-me" : ""} ${p.rank <= 3 ? `is-top is-top-${p.rank}` : ""}`}>
                  <span className="lb-rank">{p.rank}</span>
                  <span className="lb-name">{p.username}{p.me && <em> (toi)</em>}</span>
                  <span className="lb-meta">{p.titles} titre{p.titles > 1 ? "s" : ""} · {p.s_grades} S</span>
                  <span className="lb-score">{p.total_score.toLocaleString("fr-FR")}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="lb-panel" aria-labelledby="lb-title">
          <h2 id="lb-title">Par titre</h2>
          <div className="lb-controls">
            <select
              id="lb-ost"
              aria-label="Titre"
              value={currentId ?? ""}
              onChange={(e) => select({ ost: e.target.value })}
            >
              {osts.map((o) => (
                <option key={o.id} value={o.id}>{o.title.trim()} · {o.anime_title}</option>
              ))}
            </select>
            <div className="game-difficulty" role="radiogroup" aria-label="Difficulté">
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={difficulty === d}
                  className={`game-difficulty__option ${difficulty === d ? "is-active" : ""}`}
                  onClick={() => select({ difficulty: d })}
                >
                  {DIFFICULTIES[d].label}
                </button>
              ))}
            </div>
          </div>
          {current && (
            <div className="lb-current">
              <div className="lb-current__cover"><CoverArt src={current.cover_url} label={current.anime_title} /></div>
              <div className="lb-current__info">
                <strong>{current.title.trim()}</strong>
                <span className="muted">{current.artist} · {current.anime_title}</span>
              </div>
              <Link to={`/jeu?ost=${current.id}`} className="btn btn-sm"><PlayIcon /> Jouer</Link>
            </div>
          )}
          {board === null ? (
            <p className="muted">Chargement…</p>
          ) : board.length === 0 ? (
            <p className="empty">Aucun score en {DIFFICULTIES[difficulty].label.toLowerCase()} sur ce titre pour l'instant.</p>
          ) : (
            <div className="table-wrap">
              <table className="lb-table">
                <thead>
                  <tr><th>#</th><th>Joueur</th><th>Score</th><th>Note</th><th>Précision</th><th>Combo</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {board.map((row) => (
                    <tr key={row.user_id} className={row.me ? "is-me" : ""}>
                      <td className="lb-rank">{row.rank}</td>
                      <td className="lb-name">{row.username}{row.me && <em> (toi)</em>}</td>
                      <td className="num">{row.score.toLocaleString("fr-FR")}</td>
                      <td><span className={`lb-grade lb-grade--${row.grade}`}>{row.grade}</span></td>
                      <td className="num">{Math.round(row.accuracy * 100)} %</td>
                      <td className="num">{row.max_combo}</td>
                      <td className="muted">{date.format(new Date(row.played_at))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="lb-panel lb-mine" aria-labelledby="lb-mine">
        <h2 id="lb-mine">Mes records</h2>
        {!user ? (
          <p className="muted"><Link to="/login">Connecte-toi</Link> pour enregistrer tes scores et apparaître au classement.</p>
        ) : mine.length === 0 ? (
          <p className="muted">Termine une partie pour voir tes records ici.</p>
        ) : (
          <div className="table-wrap">
            <table className="lb-table">
              <thead>
                <tr><th>Titre</th><th>Niveau</th><th>Score</th><th>Note</th><th>Rang</th><th>Parties</th><th /></tr>
              </thead>
              <tbody>
                {mine.map((s) => (
                  <tr key={`${s.ost_id}-${s.difficulty}`}>
                    <td>
                      <button type="button" className="lb-link" onClick={() => select({ ost: String(s.ost_id), difficulty: s.difficulty })}>
                        {s.ost.title.trim()}
                      </button>
                      <span className="muted lb-sub">{s.ost.anime_title}</span>
                    </td>
                    <td>{DIFFICULTIES[s.difficulty].label}</td>
                    <td className="num">{s.score.toLocaleString("fr-FR")}</td>
                    <td><span className={`lb-grade lb-grade--${s.grade}`}>{s.grade}</span></td>
                    <td className="num">{ordinal(s.rank)}</td>
                    <td className="num">{s.attempts}</td>
                    <td><Link to={`/jeu?ost=${s.ost_id}`} className="btn btn-ghost btn-sm">Rejouer</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
