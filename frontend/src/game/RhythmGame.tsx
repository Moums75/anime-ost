import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import CoverArt from "../components/CoverArt";
import { CloseIcon, PauseIcon, PlayIcon } from "../components/Icons";
import { usePlayer } from "../player";
import type { Ost, RankedScore } from "../types";
import { analyzedChart, DIFFICULTIES, generatedChart, saveBest, type Difficulty, type Lane, type Note } from "./chart";
import { computeLayout, createEffects, drawFrame, laneAt, LANE_COLORS, type Layout } from "./draw";
import { Game, grade, JUDGEMENT_LABELS, type Judgement, type Stats } from "./engine";

const KEYS: Record<string, Lane> = {
  ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3,
  d: 0, f: 1, j: 2, k: 3, D: 0, F: 1, J: 2, K: 3,
};
const LANE_NAMES = ["gauche", "bas", "haut", "droite"];
const PAD_ROTATIONS = [-90, 180, 0, 90];

/** Même flèche que dans le jeu, en SVG (les caractères ← ↓ ↑ → s'affichent différemment selon les téléphones) */
const PadArrow = ({ lane }: { lane: number }) => (
  <svg viewBox="-50 -50 100 100" width="1em" height="1em" aria-hidden="true">
    <path
      transform={`rotate(${PAD_ROTATIONS[lane]})`}
      d="M0 -40 L40 -2 L17 -2 L17 34 Q17 40 11 40 L-11 40 Q-17 40 -17 34 L-17 -2 L-40 -2 Z"
      fill="currentColor"
    />
  </svg>
);
const KEY_HINTS = ["← / D", "↓ / F", "↑ / J", "→ / K"];

type Phase = "loading" | "running" | "done";

interface Props {
  ost: Ost;
  difficulty: Difficulty;
  onExit: () => void;
  onReplay: () => void;
}

export default function RhythmGame({ ost, difficulty, onExit, onReplay }: Props) {
  const player = usePlayer();
  const playerRef = useRef(player);
  playerRef.current = player;

  const cfg = DIFFICULTIES[difficulty];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<Layout>(computeLayout(400, 600));
  const gameRef = useRef<Game | null>(null);
  const clockRef = useRef(0);
  const startedRef = useRef(false);
  const fx = useRef(createEffects());

  const [phase, setPhase] = useState<Phase>("loading");
  const [loadingText, setLoadingText] = useState(ost.audio_url ? "Analyse de la musique…" : "Préparation du rythme…");
  const [mode, setMode] = useState<"analysed" | "generated">(ost.audio_url ? "analysed" : "generated");
  const [stats, setStats] = useState<Stats | null>(null);
  const [record, setRecord] = useState(false);
  const { user } = useAuth();
  // Résultat côté serveur (joueur connecté) : rang + top 5 du titre
  const [online, setOnline] = useState<{ rank: number; players: number } | null>(null);
  const [board, setBoard] = useState<RankedScore[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [error, setError] = useState("");

  // Le lecteur YouTube est replacé à côté du jeu, le reste de l'interface est masqué
  useEffect(() => {
    document.body.classList.add("game-mode");
    return () => document.body.classList.remove("game-mode");
  }, []);

  // 1. Préparer les notes, puis lancer la musique depuis le début
  useEffect(() => {
    let cancelled = false;
    const build = async (): Promise<Note[]> => {
      if (ost.audio_url) {
        try {
          return await analyzedChart(ost.audio_url, ost.id, difficulty);
        } catch {
          setMode("generated"); // fichier illisible par le navigateur : rythme généré
        }
      }
      return generatedChart(ost.id, difficulty, 0);
    };
    build()
      .then((notes) => {
        if (cancelled) return;
        if (notes.length === 0) throw new Error("Aucune note détectée dans ce morceau");
        gameRef.current = new Game(notes);
        setStats(gameRef.current.stats);
        setLoadingText(ost.youtube_id && !ost.audio_url ? "Lancement de la vidéo…" : "Lancement…");
        playerRef.current.playFromStart(ost);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [ost, difficulty]);

  // En quittant la page en pleine partie, on coupe la musique
  useEffect(
    () => () => {
      const p = playerRef.current;
      if (p.current?.id === ost.id && p.playing) p.pause();
    },
    [ost.id],
  );

  // Taille du canvas = taille de la zone de jeu (net sur les écrans haute densité)
  useEffect(() => {
    const stage = stageRef.current!;
    const canvas = canvasRef.current!;
    const resize = () => {
      const { width, height } = stage.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
      layoutRef.current = computeLayout(width, height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const finish = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    game.update(Infinity); // les notes restantes comptent comme ratées
    const p = playerRef.current;
    if (p.current?.id === ost.id && p.playing) p.pause(); // "Terminer" avant la fin du morceau
    const final = game.stats;
    setStats(final);
    setPhase("done");
    const hits = final.counts.perfect + final.counts.great + final.counts.good;
    if (!user || hits === 0) {
      setRecord(saveBest(ost.id, difficulty, final.score)); // invité : record gardé dans le navigateur
    } else {
      api
        .submitScore({ ost_id: ost.id, difficulty, score: final.score, max_combo: final.maxCombo, counts: final.counts })
        .then(async (result) => {
          setRecord(result.new_record);
          setOnline({ rank: result.rank, players: result.players });
          setBoard(await api.leaderboard(ost.id, difficulty, 5));
        })
        .catch((e: Error) => {
          setSubmitError(e.message);
          setRecord(saveBest(ost.id, difficulty, final.score));
        });
    }
    // Efface la dernière image (combo, notes) pour que l'écran de résultats soit lisible
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, [ost.id, difficulty, user]);

  // 2. Boucle de jeu : horloge calée sur la musique + dessin à chaque image
  const done = phase === "done";
  useEffect(() => {
    if (done) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const p = playerRef.current;
      const game = gameRef.current;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const ours = p.current?.id === ost.id;
      const playerTime = ours ? p.getTime() : 0;

      // L'horloge avance en douceur à chaque image et se recale sur le lecteur s'il dérive
      // (YouTube ne donne sa position qu'approximativement).
      if (ours && p.playing) {
        if (!startedRef.current) {
          startedRef.current = true;
          setPhase("running");
        }
        clockRef.current += dt;
        const drift = playerTime - clockRef.current;
        clockRef.current = Math.abs(drift) > 0.15 ? playerTime : clockRef.current + drift * 0.08;
      } else {
        clockRef.current = playerTime;
      }

      if (game) {
        if (game.update(clockRef.current) > 0) {
          fx.current.last = { judgement: "miss", at: now };
          setStats(game.stats);
        }
        drawFrame(ctx, layoutRef.current, game, clockRef.current, cfg.travel, fx.current, now);
      }

      // Fin du morceau
      if (startedRef.current && ours && !p.playing && p.duration > 0 && playerTime >= p.duration - 0.8) {
        finish();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [done, ost.id, cfg.travel, finish]);

  const press = useCallback((lane: Lane) => {
    const now = performance.now();
    fx.current.pressedAt[lane] = now;
    const game = gameRef.current;
    if (!game || !startedRef.current) return;
    const result = game.press(lane, clockRef.current);
    if (!result) return;
    fx.current.hits[lane] = { at: now, judgement: result.judgement };
    fx.current.last = { judgement: result.judgement, at: now };
    setStats(game.stats);
  }, []);

  // Clavier
  useEffect(() => {
    if (phase === "done") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
      if (e.key === "Escape") {
        playerRef.current.pause();
        return;
      }
      const lane = KEYS[e.key];
      if (lane === undefined) return;
      e.preventDefault(); // les flèches ne font pas défiler la page
      if (!e.repeat) press(lane);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, press]);

  const onStagePointer = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const lane = laneAt(layoutRef.current, e.clientX - rect.left);
    if (lane !== null) press(lane as Lane);
  };

  const paused = phase === "running" && !player.playing && player.current?.id === ost.id;
  const progress = player.duration > 0 && player.current?.id === ost.id ? Math.min(1, player.currentTime / player.duration) : 0;
  const isVideo = !ost.audio_url && Boolean(ost.youtube_id);

  return (
    <div className={`rg ${isVideo ? "rg--video" : ""}`}>
      <header className="rg__hud">
        <button className="icon-btn" onClick={onExit} title="Quitter le jeu"><CloseIcon /></button>
        <div className="rg__track">
          <div className="rg__cover"><CoverArt src={ost.cover_url} label={ost.anime_title} /></div>
          <div className="rg__track-text">
            <strong>{ost.title}</strong>
            <span>{cfg.label} · {mode === "analysed" ? "notes calées sur l'audio" : "rythme généré"}</span>
          </div>
        </div>
        <div className="rg__stats">
          <div><span>Score</span><strong>{(stats?.score ?? 0).toLocaleString("fr-FR")}</strong></div>
          <div><span>Combo</span><strong>{stats?.combo ?? 0}</strong></div>
          <div><span>Précision</span><strong>{Math.round((stats?.accuracy ?? 1) * 100)} %</strong></div>
        </div>
        {phase === "running" && (
          <button className="icon-btn" onClick={() => player.toggle()} title={player.playing ? "Pause (Échap)" : "Reprendre"}>
            {player.playing ? <PauseIcon /> : <PlayIcon />}
          </button>
        )}
        <div className="rg__progress" style={{ width: `${progress * 100}%` }} aria-hidden="true" />
      </header>

      <div className="rg__video-slot" aria-hidden="true" />

      <div className="rg__stage" ref={stageRef}>
        <canvas ref={canvasRef} onPointerDown={onStagePointer} aria-label="Zone de jeu" />
        <div className="rg__keys" aria-hidden="true">
          {KEY_HINTS.map((hint, i) => <span key={hint} style={{ color: LANE_COLORS[i] }}>{hint}</span>)}
        </div>

        {(phase === "loading" || error) && (
          <div className="rg__overlay">
            {error ? (
              <>
                <p className="error">{error}</p>
                <button className="btn" onClick={onExit}>Choisir une autre musique</button>
              </>
            ) : (
              <>
                <div className="rg__spinner" aria-hidden="true" />
                <p>{loadingText}</p>
                {player.error && <p className="error">{player.error}</p>}
              </>
            )}
          </div>
        )}

        {paused && (
          <div className="rg__overlay">
            <p className="rg__overlay-title">Pause</p>
            <button className="btn btn-lg" onClick={() => player.toggle()}><PlayIcon /> Reprendre</button>
            <button className="btn btn-ghost" onClick={onExit}>Quitter</button>
          </div>
        )}

        {phase === "done" && stats && (
          <div className="rg__overlay rg__results">
            <p className="eyebrow">Résultat · {cfg.label}</p>
            <div className={`rg__grade rg__grade--${grade(stats.accuracy)}`}>{grade(stats.accuracy)}</div>
            <p className="rg__score">{stats.score.toLocaleString("fr-FR")}</p>
            {record && <p className="rg__record">Nouveau record !</p>}
            {online && (
              <p className="rg__rank">
                {online.rank === 1 ? "1er" : `${online.rank}e`} sur {online.players} joueur{online.players > 1 ? "s" : ""} sur ce titre
              </p>
            )}
            {!user && (
              <p className="muted rg__login">
                <Link to="/login">Connecte-toi</Link> pour enregistrer ton score dans le classement.
              </p>
            )}
            {submitError && <p className="error">Score non enregistré : {submitError}</p>}
            <dl className="rg__counts">
              {(Object.keys(JUDGEMENT_LABELS) as Judgement[]).map((j) => (
                <div key={j} className={`rg__count rg__count--${j}`}>
                  <dt>{JUDGEMENT_LABELS[j]}</dt>
                  <dd>{stats.counts[j]}</dd>
                </div>
              ))}
              <div className="rg__count"><dt>Combo max</dt><dd>{stats.maxCombo}</dd></div>
              <div className="rg__count"><dt>Précision</dt><dd>{Math.round(stats.accuracy * 100)} %</dd></div>
            </dl>
            {board.length > 0 && (
              <ol className="rg__board" aria-label="Top 5 de ce titre">
                {board.map((row) => (
                  <li key={row.user_id} className={row.me ? "is-me" : ""}>
                    <span className="rg__board-rank">{row.rank}</span>
                    <span className="rg__board-name">{row.username}</span>
                    <span className="rg__board-grade">{row.grade}</span>
                    <span className="rg__board-score">{row.score.toLocaleString("fr-FR")}</span>
                  </li>
                ))}
              </ol>
            )}
            <div className="page-actions">
              <button className="btn btn-lg" onClick={onReplay}><PlayIcon /> Rejouer</button>
              <button className="btn btn-ghost" onClick={onExit}>Autre musique</button>
              <Link className="btn btn-ghost" to={`/jeu/classement?ost=${ost.id}&difficulty=${difficulty}`}>Classement</Link>
            </div>
          </div>
        )}
      </div>

      {/* Flèches tactiles (téléphone / tablette) */}
      <div className="rg__pads">
        {LANE_NAMES.map((name, lane) => (
          <button
            key={name}
            type="button"
            className="rg__pad"
            style={{ color: LANE_COLORS[lane], borderColor: LANE_COLORS[lane] + "88" }}
            onPointerDown={(e) => {
              e.preventDefault();
              press(lane as Lane);
            }}
            aria-label={`Flèche ${name}`}
          >
            <PadArrow lane={lane} />
          </button>
        ))}
      </div>
      {phase === "running" && (
        <button className="rg__finish btn btn-ghost btn-sm" onClick={finish}>Terminer</button>
      )}
    </div>
  );
}
