import { useEffect, useRef, useState, type CSSProperties } from "react";
import inosukeRun from "../assets/mascots/inosuke-run.webp";
import fightScene from "../assets/mascots/kyuubi-vs-orochimaru.webp";
import narutoRun from "../assets/mascots/naruto-run.webp";
import zenitsuDash from "../assets/mascots/zenitsu-dash.webp";

/**
 * Petits personnages en pixel art qui apparaissent de temps en temps pendant l'écoute,
 * posés sur le bord du lecteur. Purement décoratif : aucun clic intercepté.
 */
interface Mascot {
  name: string;
  src: string;
  /** "run" : traverse l'écran ; "scene" : apparaît sur place le temps de son animation */
  kind: "run" | "scene";
  /** Hauteur affichée (px) : les pieds des persos sont en bas de l'image */
  height: number;
  /** Ratio largeur / hauteur de l'image */
  ratio: number;
  /** Durée de l'apparition (ms) */
  duration: number;
}

const MASCOTS: Mascot[] = [
  { name: "naruto", src: narutoRun, kind: "run", height: 84, ratio: 95 / 84, duration: 7000 },
  { name: "zenitsu", src: zenitsuDash, kind: "run", height: 84, ratio: 88 / 84, duration: 4500 },
  { name: "inosuke", src: inosukeRun, kind: "run", height: 84, ratio: 63 / 84, duration: 5500 },
  // Durée = une boucle complète du GIF d'origine (67 images)
  { name: "fight", src: fightScene, kind: "scene", height: 180, ratio: 500 / 300, duration: 8040 },
];

const FIRST_DELAY = 8_000;
const MIN_DELAY = 35_000;
const MAX_DELAY = 70_000;

const random = (min: number, max: number) => min + Math.random() * (max - min);

interface Appearance {
  mascot: Mascot;
  url: string;
  left: number;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export default function Mascots({ playing }: { playing: boolean }) {
  const [appearance, setAppearance] = useState<Appearance | null>(null);
  const [retry, setRetry] = useState(0);
  const blobs = useRef(new Map<string, Blob>());
  const lastName = useRef<string | null>(null);
  const appearedOnce = useRef(false);

  // Images téléchargées une seule fois. Chaque apparition utilise une nouvelle URL "blob:"
  // pour que l'animation reparte bien de la 1re image.
  useEffect(() => {
    if (!playing) return;
    for (const mascot of MASCOTS) {
      if (blobs.current.has(mascot.name)) continue;
      fetch(mascot.src)
        .then((res) => res.blob())
        .then((blob) => blobs.current.set(mascot.name, blob))
        .catch(() => undefined);
    }
  }, [playing]);

  // Planifie la prochaine apparition, uniquement pendant la lecture
  useEffect(() => {
    if (!playing || appearance || prefersReducedMotion()) return;
    const delay = appearedOnce.current ? random(MIN_DELAY, MAX_DELAY) : FIRST_DELAY;
    const timer = setTimeout(() => {
      const choices = MASCOTS.filter((m) => m.name !== lastName.current && blobs.current.has(m.name));
      if (document.hidden || choices.length === 0) {
        setRetry((n) => n + 1); // onglet en arrière-plan ou images pas prêtes : on retente plus tard
        return;
      }
      const mascot = choices[Math.floor(Math.random() * choices.length)];
      const width = mascot.height * mascot.ratio;
      // Les scènes restent sur la moitié gauche : à droite il y a la vidéo YouTube et le volume
      const left = mascot.kind === "scene" ? random(16, Math.max(16, window.innerWidth * 0.5 - width)) : 0;
      appearedOnce.current = true;
      setAppearance({ mascot, left, url: URL.createObjectURL(blobs.current.get(mascot.name)!) });
    }, delay);
    return () => clearTimeout(timer);
  }, [playing, appearance, retry]);

  if (!appearance) return null;
  const { mascot, url, left } = appearance;

  const finish = () => {
    URL.revokeObjectURL(url);
    lastName.current = mascot.name;
    setAppearance(null);
  };

  return (
    <img
      key={url}
      src={url}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`mascot mascot--${mascot.kind}`}
      style={{ "--h": `${mascot.height}px`, "--duration": `${mascot.duration}ms`, left } as CSSProperties}
      onAnimationEnd={finish}
      onError={finish}
    />
  );
}
