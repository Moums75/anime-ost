export type Kind = "opening" | "ending" | "ost" | "insert";
export type MediaKind = "audio" | "cover";

export const KIND_LABELS: Record<Kind, string> = {
  opening: "Opening",
  ending: "Ending",
  ost: "OST",
  insert: "Insert song",
};

export interface User {
  id: number;
  username: string;
  role: "user" | "admin";
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface Ost {
  id: number;
  title: string;
  artist: string;
  kind: Kind;
  youtube_url: string;
  anime_id: number;
  anime_title: string;
  /** Fichier audio hébergé par l'API (prioritaire sur YouTube) */
  audio_url: string | null;
  /** Vidéo YouTube officielle jouée dans le lecteur intégré quand il n'y a pas de fichier audio */
  youtube_id: string | null;
  cover_url: string | null;
  favorite: boolean;
}

export interface OstPage {
  items: Ost[];
  total: number;
}

export interface Anime {
  id: number;
  title: string;
  studio: string;
  year: number;
  mal_id: number | null;
  image_url: string | null;
  ost_count: number;
}

export interface AnimeDetail extends Anime {
  osts: Ost[];
}

export interface OstFilters {
  q?: string;
  anime_id?: string;
  kind?: string;
  limit?: number;
  offset?: number;
}

/** Une OST est jouable sur le site si elle a un fichier audio ou une vidéo YouTube intégrable */
export const isPlayable = (ost: Ost) => Boolean(ost.audio_url || ost.youtube_id);

export interface HistoryEntry {
  id: number;
  /** Date ISO en UTC */
  played_at: string;
  ost: Ost;
}

export interface HistoryPage {
  items: HistoryEntry[];
  total: number;
}

export interface PlaylistSummary {
  id: number;
  name: string;
  description: string;
  ost_count: number;
  ost_ids: number[];
  /** 4 premières OST, pour la mosaïque de pochettes */
  preview: Ost[];
  created_at: string;
  updated_at: string;
}

export interface PlaylistDetail extends PlaylistSummary {
  osts: Ost[];
}

// ---------- Mini-jeu : classements ----------

export type GameDifficulty = "easy" | "normal" | "hard";

export interface GameScore {
  user_id: number;
  username: string;
  ost_id: number;
  difficulty: GameDifficulty;
  score: number;
  accuracy: number;
  grade: string;
  max_combo: number;
  perfect: number;
  great: number;
  good: number;
  miss: number;
  attempts: number;
  played_at: string;
}

export interface RankedScore extends GameScore {
  rank: number;
  /** Ligne du joueur connecté */
  me: boolean;
}

export interface MyScore extends GameScore {
  rank: number;
  ost: Ost;
}

export interface PlayerRanking {
  rank: number;
  user_id: number;
  username: string;
  total_score: number;
  titles: number;
  s_grades: number;
  me: boolean;
}

export interface SubmitResult {
  best: GameScore;
  new_record: boolean;
  rank: number;
  players: number;
}
