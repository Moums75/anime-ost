import type { Lane, Note } from "./chart";

export type Judgement = "perfect" | "great" | "good" | "miss";

/** Écart maximal (s) entre l'appui et la note pour chaque jugement */
export const WINDOWS = { perfect: 0.05, great: 0.1, good: 0.15 } as const;
const POINTS: Record<Judgement, number> = { perfect: 300, great: 200, good: 100, miss: 0 };
const ACCURACY: Record<Judgement, number> = { perfect: 1, great: 0.7, good: 0.4, miss: 0 };

export const JUDGEMENT_LABELS: Record<Judgement, string> = {
  perfect: "Parfait",
  great: "Super",
  good: "Bien",
  miss: "Raté",
};

export interface Stats {
  score: number;
  combo: number;
  maxCombo: number;
  counts: Record<Judgement, number>;
  accuracy: number; // 0..1 sur les notes déjà jugées
}

/** État d'une partie : quelles notes ont été jouées, score, combo. Indépendant de l'affichage. */
export class Game {
  readonly notes: Note[];
  readonly judged: (Judgement | null)[];
  private cursor = 0; // première note pas encore jugée
  score = 0;
  combo = 0;
  maxCombo = 0;
  counts: Record<Judgement, number> = { perfect: 0, great: 0, good: 0, miss: 0 };

  constructor(notes: Note[]) {
    this.notes = [...notes].sort((a, b) => a.time - b.time);
    this.judged = this.notes.map(() => null);
  }

  private record(index: number, judgement: Judgement) {
    this.judged[index] = judgement;
    this.counts[judgement]++;
    if (judgement === "miss") {
      this.combo = 0;
      return;
    }
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    // Bonus de combo : jusqu'à ×2 à partir de 50 notes d'affilée
    this.score += Math.round(POINTS[judgement] * (1 + Math.min(this.combo, 50) / 50));
  }

  /** Appui sur une flèche à l'instant t : renvoie le jugement, ou null si aucune note n'était proche */
  press(lane: Lane, t: number): { judgement: Judgement; index: number } | null {
    for (let i = this.cursor; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (note.time > t + WINDOWS.good) break;
      if (this.judged[i] || note.lane !== lane) continue;
      const delta = Math.abs(note.time - t);
      if (delta > WINDOWS.good) continue;
      const judgement: Judgement = delta <= WINDOWS.perfect ? "perfect" : delta <= WINDOWS.great ? "great" : "good";
      this.record(i, judgement);
      return { judgement, index: i };
    }
    return null; // appui "dans le vide" : pas de pénalité
  }

  /** Marque comme ratées les notes dépassées ; renvoie le nombre de nouveaux ratés */
  update(t: number): number {
    let missed = 0;
    while (this.cursor < this.notes.length) {
      const i = this.cursor;
      if (this.judged[i]) {
        this.cursor++;
        continue;
      }
      if (this.notes[i].time >= t - WINDOWS.good) break;
      this.record(i, "miss");
      missed++;
      this.cursor++;
    }
    return missed;
  }

  get stats(): Stats {
    const total = this.counts.perfect + this.counts.great + this.counts.good + this.counts.miss;
    const weighted = (Object.keys(this.counts) as Judgement[]).reduce((sum, j) => sum + this.counts[j] * ACCURACY[j], 0);
    return {
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      counts: { ...this.counts },
      accuracy: total ? weighted / total : 1,
    };
  }
}

export function grade(accuracy: number): string {
  if (accuracy >= 0.95) return "S";
  if (accuracy >= 0.85) return "A";
  if (accuracy >= 0.7) return "B";
  if (accuracy >= 0.55) return "C";
  return "D";
}
