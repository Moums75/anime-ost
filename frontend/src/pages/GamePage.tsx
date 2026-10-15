import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import CoverArt from "../components/CoverArt";
import { PlayIcon, SearchIcon, TrophyIcon } from "../components/Icons";
import { DIFFICULTIES, getBest, type Difficulty } from "../game/chart";
import RhythmGame from "../game/RhythmGame";
import { isPlayable, type Ost } from "../types";

const DIFFICULTY_KEY = "animeost_game_difficulty";

function storedDifficulty(): Difficulty {
  try {
    const value = localStorage.getItem(DIFFICULTY_KEY);
    return value === "easy" || value === "hard" ? value : "normal";
  } catch {
    return "normal";
  }
}

interface Session {
  ost: Ost;
  difficulty: Difficulty;
  round: number; // change à chaque "Rejouer" pour repartir d'une partie neuve
}

export default function GamePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  // Records du joueur connecté, enregistrés dans l'API (sinon : records du navigateur)
  const [serverBest, setServerBest] = useState<Map<string, number>>(new Map());
  const [osts, setOsts] = useState<Ost[]>([]);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>(storedDifficulty);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .osts({ limit: 200 })
      .then((page) => setOsts(page.items.filter(isPlayable)))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!user) return setServerBest(new Map());
    api
      .myScores()
      .then((scores) => setServerBest(new Map(scores.map((s) => [`${s.ost_id}:${s.difficulty}`, s.score]))))
      .catch(() => setServerBest(new Map()));
  }, [user, session]); // recharge en revenant d'une partie

  const bestOf = (ost: Ost) => (user ? serverBest.get(`${ost.id}:${difficulty}`) ?? 0 : getBest(ost.id, difficulty));

  useEffect(() => {
    try {
      localStorage.setItem(DIFFICULTY_KEY, difficulty);
    } catch {
      // pas grave
    }
  }, [difficulty]);

  // Titre choisi depuis le lecteur (bouton manette) : /jeu?ost=12
  const selected = osts.find((o) => String(o.id) === params.get("ost")) ?? null;

  const start = (ost: Ost) => setSession({ ost, difficulty, round: 0 });

  if (session) {
    return (
      <RhythmGame
        key={`${session.ost.id}-${session.difficulty}-${session.round}`}
        ost={session.ost}
        difficulty={session.difficulty}
        onExit={() => {
          setSession(null);
          setParams({});
        }}
        onReplay={() => setSession({ ...session, round: session.round + 1 })}
      />
    );
  }

  const q = query.trim().toLowerCase();
  const list = osts.filter((o) => !q || `${o.title} ${o.artist} ${o.anime_title}`.toLowerCase().includes(q));

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Mini-jeu de rythme</p>
          <h1>
            OST <span className="gradient-text">Rush</span>
          </h1>
          <p className="muted">
            Les flèches descendent au rythme de la musique : appuie au moment où elles touchent la ligne.
          </p>
        </div>
        <Link to="/jeu/classement" className="btn btn-ghost btn-lg"><TrophyIcon /> Classements</Link>
      </header>
      {!user && (
        <p className="notice game-guest">
          Tu joues en invité : tes records restent dans ce navigateur. <Link to="/login">Connecte-toi</Link> pour entrer dans le classement.
        </p>
      )}

      <div className="game-intro">
        <div className="game-howto">
          <div className="game-howto__keys" aria-hidden="true">
            <kbd>←</kbd><kbd>↓</kbd><kbd>↑</kbd><kbd>→</kbd>
          </div>
          <p><strong>Clavier :</strong> les flèches, ou D F J K. Échap ou Espace = pause.</p>
          <p><strong>Téléphone / tablette :</strong> touche les grosses flèches en bas de l'écran ou directement les couloirs.</p>
          <p className="muted">Avec un fichier audio, les notes sont calées sur les attaques de la musique. Avec une vidéo YouTube, le son n'est pas accessible au site : le rythme est généré, toujours le même pour un titre et un niveau.</p>
        </div>
        <div className="game-difficulty" role="radiogroup" aria-label="Difficulté">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={difficulty === d}
              className={`game-difficulty__option ${difficulty === d ? "is-active" : ""}`}
              onClick={() => setDifficulty(d)}
            >
              {DIFFICULTIES[d].label}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="game-selected">
          <div className="game-selected__cover"><CoverArt src={selected.cover_url} label={selected.anime_title} /></div>
          <div className="game-selected__info">
            <p className="eyebrow">Titre choisi</p>
            <strong>{selected.title}</strong>
            <span className="muted">{selected.artist} · {selected.anime_title}</span>
          </div>
          <Link to={`/jeu/classement?ost=${selected.id}&difficulty=${difficulty}`} className="btn btn-ghost"><TrophyIcon /> Classement</Link>
          <button className="btn btn-lg" onClick={() => start(selected)}><PlayIcon /> Jouer</button>
        </div>
      )}

      <label className="search game-search">
        <SearchIcon />
        <input id="game-search" placeholder="Choisis une musique…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}

      <ul className="game-list">
        {list.map((ost) => {
          const best = bestOf(ost);
          return (
            <li key={ost.id}>
              <button type="button" className="game-row" onClick={() => start(ost)}>
                <span className="game-row__cover"><CoverArt src={ost.cover_url} label={ost.anime_title} /></span>
                <span className="game-row__info">
                  <strong>{ost.title}</strong>
                  <span>{ost.artist} · {ost.anime_title}</span>
                </span>
                <span className={`game-row__mode ${ost.audio_url ? "is-audio" : ""}`}>
                  {ost.audio_url ? "Audio analysé" : "Rythme généré"}
                </span>
                <span className="game-row__best">{best ? `Record ${best.toLocaleString("fr-FR")}` : "—"}</span>
                <span className="game-row__play" aria-hidden="true"><PlayIcon /></span>
              </button>
            </li>
          );
        })}
      </ul>
      {osts.length > 0 && list.length === 0 && <p className="empty">Aucune musique ne correspond.</p>}
    </>
  );
}
