/**
 * Génération des notes du mini-jeu ("chart").
 *
 * - Fichier audio hébergé par l'API : on décode le son et on détecte les attaques
 *   (onsets) pour poser les notes sur la musique.
 * - Vidéo YouTube : le site n'a pas accès au son de l'iframe, donc on génère un rythme
 *   régulier. Le générateur est "seedé" par l'OST et la difficulté : même titre + même
 *   niveau = mêmes notes, pour que les records soient comparables.
 */

export type Difficulty = "easy" | "normal" | "hard";
export type Lane = 0 | 1 | 2 | 3; // ← ↓ ↑ →

export interface Note {
  time: number; // secondes depuis le début du morceau
  lane: Lane;
}

export interface DifficultyConfig {
  label: string;
  /** Temps (s) que met une note pour descendre du haut jusqu'à la ligne de frappe */
  travel: number;
  /** Écart minimal entre deux notes détectées dans l'audio (s) */
  minGap: number;
  /** Intervalle de base du rythme généré pour YouTube (s) */
  beat: number;
  doubleChance: number;
  restChance: number;
  chordChance: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: { label: "Facile", travel: 1.9, minGap: 0.45, beat: 0.8, doubleChance: 0, restChance: 0.2, chordChance: 0 },
  normal: { label: "Normal", travel: 1.45, minGap: 0.27, beat: 0.5, doubleChance: 0.15, restChance: 0.15, chordChance: 0.04 },
  hard: { label: "Difficile", travel: 1.1, minGap: 0.16, beat: 0.36, doubleChance: 0.3, restChance: 0.1, chordChance: 0.12 },
};

const FIRST_NOTE_AT = 2.5; // laisse le temps de se placer
const MAX_LENGTH = 15 * 60; // garde-fou si la durée est inconnue

/** Petit générateur pseudo-aléatoire déterministe (mulberry32) */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedFor = (ostId: number, difficulty: Difficulty) => ostId * 7919 + { easy: 1, normal: 2, hard: 3 }[difficulty];

/** Répartit des instants sur les 4 flèches, sans jamais 3 fois la même d'affilée, avec quelques accords. */
function toNotes(times: number[], rng: () => number, chordChance: number, strong: Set<number> = new Set()): Note[] {
  const notes: Note[] = [];
  let last = -1;
  let repeat = 0;
  times.forEach((time, i) => {
    let lane = Math.floor(rng() * 4) as Lane;
    if (lane === last && repeat >= 1) lane = ((lane + 1 + Math.floor(rng() * 3)) % 4) as Lane;
    repeat = lane === last ? repeat + 1 : 0;
    last = lane;
    notes.push({ time, lane });
    if (rng() < chordChance || (chordChance > 0 && strong.has(i))) {
      notes.push({ time, lane: ((lane + 2) % 4) as Lane }); // accord : flèche opposée
    }
  });
  return notes;
}

/** Rythme généré (vidéos YouTube) */
export function generatedChart(ostId: number, difficulty: Difficulty, duration: number): Note[] {
  const cfg = DIFFICULTIES[difficulty];
  const rng = seeded(seedFor(ostId, difficulty));
  const end = (duration > 0 ? duration : MAX_LENGTH) - 2;
  const times: number[] = [];
  for (let t = FIRST_NOTE_AT; t < end; t += cfg.beat) {
    // Toutes les 16 temps, une courte respiration
    if (Math.round((t - FIRST_NOTE_AT) / cfg.beat) % 16 === 15) continue;
    if (rng() < cfg.restChance) continue;
    times.push(+t.toFixed(3));
    if (rng() < cfg.doubleChance) times.push(+(t + cfg.beat / 2).toFixed(3));
  }
  return toNotes(times, rng, cfg.chordChance);
}

/**
 * Détection d'attaques dans un fichier audio ("spectral flux" simplifié) :
 * énergie des variations du signal par fenêtre de ~12 ms, on garde les montées
 * nettement au-dessus de la moyenne locale.
 */
export async function analyzedChart(url: string, ostId: number, difficulty: Difficulty): Promise<Note[]> {
  const cfg = DIFFICULTIES[difficulty];
  const data = await (await fetch(url)).arrayBuffer();
  const audio = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(data);

  // Mono
  const length = audio.length;
  const mono = new Float32Array(length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const channel = audio.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += channel[i] / audio.numberOfChannels;
  }

  // Énergie des différences (accentue les attaques, comme un filtre passe-haut), en log
  const hop = 512;
  const frames = Math.floor(length / hop);
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * hop + 1; i < (f + 1) * hop; i++) {
      const d = mono[i] - mono[i - 1];
      sum += d * d;
    }
    energy[f] = Math.log1p(1000 * sum);
  }
  const flux = new Float32Array(frames);
  for (let f = 1; f < frames; f++) flux[f] = Math.max(0, energy[f] - energy[f - 1]);

  // Seuil adaptatif : moyenne sur ±0,5 s
  const frameTime = hop / audio.sampleRate;
  const radius = Math.round(0.5 / frameTime);
  const prefix = new Float64Array(frames + 1);
  for (let f = 0; f < frames; f++) prefix[f + 1] = prefix[f] + flux[f];

  // Plancher global : 12 % des attaques les plus fortes du morceau. Sans lui, dans un passage
  // calme (fin, intro), la moyenne locale est si basse que les ondulations d'un son tenu passent.
  const sortedFlux = Float32Array.from(flux).sort();
  const floor = Math.max(0.05, 0.12 * sortedFlux[Math.floor(0.995 * (frames - 1))]);

  const peaks: { time: number; strength: number }[] = [];
  let lastTime = -Infinity;
  for (let f = 2; f < frames - 2; f++) {
    const from = Math.max(0, f - radius);
    const to = Math.min(frames, f + radius);
    const mean = (prefix[to] - prefix[from]) / (to - from);
    const isPeak = flux[f] > flux[f - 1] && flux[f] >= flux[f + 1];
    const time = f * frameTime;
    const threshold = Math.max(mean * 1.6 + 0.02, floor);
    if (isPeak && flux[f] > threshold && time >= FIRST_NOTE_AT && time - lastTime >= cfg.minGap) {
      peaks.push({ time: +time.toFixed(3), strength: flux[f] / (mean + 1e-6) });
      lastTime = time;
    }
  }

  const rng = seeded(seedFor(ostId, difficulty));
  // Les attaques les plus fortes (top 8 %) deviennent des accords en difficile
  const sorted = [...peaks].map((p, i) => [p.strength, i] as const).sort((a, b) => b[0] - a[0]);
  const strong = new Set(cfg.chordChance >= 0.1 ? sorted.slice(0, Math.floor(peaks.length * 0.08)).map(([, i]) => i) : []);
  return toNotes(peaks.map((p) => p.time), rng, cfg.chordChance / 3, strong);
}

/** Meilleurs scores, gardés dans le navigateur */
const BEST_KEY = "animeost_game_best";

export function getBest(ostId: number, difficulty: Difficulty): number {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? "{}")[`${ostId}:${difficulty}`] ?? 0;
  } catch {
    return 0;
  }
}

/** Enregistre le score s'il bat le record ; renvoie true si c'est un nouveau record */
export function saveBest(ostId: number, difficulty: Difficulty, score: number): boolean {
  try {
    const all = JSON.parse(localStorage.getItem(BEST_KEY) ?? "{}");
    const key = `${ostId}:${difficulty}`;
    if (score <= (all[key] ?? 0)) return false;
    all[key] = score;
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}
