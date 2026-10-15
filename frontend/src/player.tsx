import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { HISTORY_EVENT } from "./library";
import { isPlayable, type Ost } from "./types";
import { YouTubeEngine } from "./youtube";

const VOLUME_KEY = "animeost_volume";

function storedVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    const value = raw === null ? NaN : Number(raw);
    return value >= 0 && value <= 1 ? value : 0.8;
  } catch {
    return 0.8;
  }
}

/** D'où vient le son de la piste : fichier hébergé par notre API, ou vidéo YouTube officielle */
export type Source = "audio" | "youtube";

const sourceOf = (ost: Ost | null): Source | null =>
  !ost ? null : ost.audio_url ? "audio" : ost.youtube_id ? "youtube" : null;

interface PlayerContextValue {
  current: Ost | null;
  source: Source | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  error: string;
  hasNext: boolean;
  /** Joue `ost` en utilisant `list` comme file d'attente (ou met en pause si c'est déjà la piste en cours). */
  play: (ost: Ost, list: Ost[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  /** Lance une OST seule depuis le début (même si c'est déjà la piste en cours) — utilisé par le mini-jeu */
  playFromStart: (ost: Ost) => void;
  pause: () => void;
  /** Position exacte lue directement dans le lecteur (plus précise que `currentTime`, rafraîchi 2×/s pour YouTube) */
  getTime: () => number;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const ytHostRef = useRef<HTMLDivElement>(null);
  const ytRef = useRef<YouTubeEngine | null>(null);
  const [queue, setQueue] = useState<Ost[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(storedVolume);
  const [error, setError] = useState("");
  const { user } = useAuth();
  const recordedId = useRef<number | null>(null);
  const current = queue[index] ?? null;
  const source = sourceOf(current);
  const hasNext = index < queue.length - 1;

  const next = useCallback(() => {
    if (hasNext) setIndex(index + 1);
  }, [hasNext, index]);

  const seek = useCallback(
    (time: number) => {
      if (source === "audio" && audioRef.current) audioRef.current.currentTime = time;
      if (source === "youtube") ytRef.current?.seek(time);
      setCurrentTime(time);
    },
    [source],
  );

  const prev = useCallback(() => {
    if (currentTime > 3 || index === 0) seek(0);
    else setIndex(index - 1);
  }, [currentTime, index, seek]);

  const toggle = useCallback(() => {
    if (source === "audio") {
      const audio = audioRef.current!;
      if (audio.paused) audio.play().catch(() => setPlaying(false));
      else audio.pause();
    } else if (source === "youtube") {
      if (playing) ytRef.current?.pause();
      else ytRef.current?.play();
    }
  }, [source, playing]);

  const pause = useCallback(() => {
    if (source === "audio") audioRef.current?.pause();
    else if (source === "youtube") ytRef.current?.pause();
  }, [source]);

  const getTime = useCallback(() => {
    if (source === "audio") return audioRef.current?.currentTime ?? 0;
    if (source === "youtube") return ytRef.current?.currentTime ?? 0;
    return 0;
  }, [source]);

  const playFromStart = (ost: Ost) => {
    if (!isPlayable(ost)) return;
    if (current?.id === ost.id) {
      seek(0);
      if (!playing) toggle();
      return;
    }
    setQueue([ost]);
    setIndex(0);
  };

  const play = (ost: Ost, list: Ost[]) => {
    if (!isPlayable(ost)) return;
    if (current?.id === ost.id) return toggle();
    const playable = list.filter(isPlayable);
    setQueue(playable);
    setIndex(playable.findIndex((o) => o.id === ost.id));
  };

  // Les événements YouTube arrivent hors de React : on passe par une ref pour toujours
  // utiliser l'état à jour (piste courante, suivante…).
  const ytEvents = useRef({ onPlay() {}, onPause() {}, onEnded() {}, onError() {} });
  ytEvents.current = {
    onPlay: () => source === "youtube" && setPlaying(true),
    onPause: () => source === "youtube" && setPlaying(false),
    onEnded: () => (hasNext ? next() : setPlaying(false)),
    onError: () => {
      setPlaying(false);
      setError("Vidéo indisponible");
    },
  };

  useEffect(() => {
    const engine = new YouTubeEngine(ytHostRef.current!, {
      onPlay: () => ytEvents.current.onPlay(),
      onPause: () => ytEvents.current.onPause(),
      onEnded: () => ytEvents.current.onEnded(),
      onError: () => ytEvents.current.onError(),
    });
    engine.preload();
    ytRef.current = engine;
    return () => engine.destroy();
  }, []);

  // Changement de piste : on démarre la bonne source et on coupe l'autre
  useEffect(() => {
    const audio = audioRef.current!;
    const yt = ytRef.current!;
    setCurrentTime(0);
    setDuration(0);
    setError("");
    if (current?.audio_url) {
      yt.stop();
      audio.src = current.audio_url;
      audio.play().catch(() => setPlaying(false));
    } else if (current?.youtube_id) {
      audio.pause();
      audio.removeAttribute("src");
      yt.load(current.youtube_id, volume);
    }
  }, [current?.id]); // volontairement : on ne relance que si la piste change

  // Historique : une écoute est enregistrée quand la piste démarre vraiment (pas au simple clic)
  useEffect(() => {
    if (!playing || !current || !user || recordedId.current === current.id) return;
    recordedId.current = current.id;
    api
      .addToHistory(current.id)
      .then(() => window.dispatchEvent(new Event(HISTORY_EVENT)))
      .catch(() => undefined); // l'historique ne doit jamais gêner la lecture
  }, [playing, current, user]);

  // Le lecteur YouTube n'émet pas d'événement de progression : on l'interroge régulièrement
  useEffect(() => {
    if (source !== "youtube" || !playing) return;
    const timer = setInterval(() => {
      setCurrentTime(ytRef.current?.currentTime ?? 0);
      setDuration(ytRef.current?.duration ?? 0);
    }, 500);
    return () => clearInterval(timer);
  }, [source, playing]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    ytRef.current?.setVolume(volume);
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      // stockage indisponible (navigation privée) : pas grave
    }
  }, [volume]);

  // Contrôles système (touches multimédia du clavier, écran de verrouillage du téléphone)
  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.anime_title,
      artwork: current.cover_url ? [{ src: current.cover_url }] : [],
    });
    navigator.mediaSession.setActionHandler("play", toggle);
    navigator.mediaSession.setActionHandler("pause", toggle);
    navigator.mediaSession.setActionHandler("nexttrack", next);
    navigator.mediaSession.setActionHandler("previoustrack", prev);
  }, [current, toggle, next, prev]);

  // Barre d'espace = lecture/pause (sauf quand on tape dans un champ)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.code !== "Space" || target.closest("input, textarea, select, button, [role=button]")) return;
      if (!current) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, toggle]);

  const value: PlayerContextValue = {
    current, source, playing, currentTime, duration, volume, error, hasNext,
    play, toggle, next, prev, seek, setVolume, playFromStart, pause, getTime,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => source === "audio" && setPlaying(true)}
        onPause={() => source === "audio" && setPlaying(false)}
        onTimeUpdate={(e) => source === "audio" && setCurrentTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => source === "audio" && setDuration(e.currentTarget.duration || 0)}
        onEnded={() => (hasNext ? next() : setPlaying(false))}
        onError={() => {
          if (source !== "audio") return;
          setPlaying(false);
          setError("Lecture impossible");
        }}
      />
      {/* Lecteur YouTube : il doit rester visible pendant la lecture (conditions d'utilisation YouTube) */}
      <div className={`yt-panel ${source === "youtube" ? "yt-panel--visible" : ""}`} aria-hidden={source !== "youtube"}>
        <div ref={ytHostRef} className="yt-panel__frame" />
      </div>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer doit être utilisé dans <PlayerProvider>");
  return ctx;
}
