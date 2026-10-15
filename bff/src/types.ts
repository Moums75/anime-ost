export interface User {
  id: number;
  username: string;
  role: "user" | "admin";
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

/** OST telle que renvoyée par le service métier */
export interface Ost {
  id: number;
  title: string;
  artist: string;
  kind: "opening" | "ending" | "ost" | "insert";
  youtube_url: string;
  anime_id: number;
  anime_title: string;
  anime_image_url: string | null;
  audio_filename: string | null;
  cover_filename: string | null;
}

/** OST telle que renvoyée au front : URLs prêtes à l'emploi + flag favori */
export interface ClientOst extends Omit<Ost, "audio_filename" | "cover_filename" | "anime_image_url"> {
  audio_url: string | null;
  /** ID de la vidéo YouTube à lire dans le lecteur intégré (null si le lien n'est pas une vidéo) */
  youtube_id: string | null;
  cover_url: string | null;
  favorite: boolean;
}

export interface OstPage<T = Ost> {
  items: T[];
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

export interface HistoryEntry<T = Ost> {
  id: number;
  played_at: string;
  ost: T;
}

export interface PlaylistSummary<T = Ost> {
  id: number;
  name: string;
  description: string;
  ost_count: number;
  ost_ids: number[];
  preview: T[];
  created_at: string;
  updated_at: string;
}

export interface PlaylistDetail<T = Ost> extends PlaylistSummary<T> {
  osts: T[];
}
