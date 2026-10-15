import type {
  Anime, AnimeDetail, AuthResponse, HistoryEntry, HistoryPage, MediaKind, Ost, OstFilters, OstPage,
  GameDifficulty, MyScore, PlayerRanking, PlaylistDetail, PlaylistSummary, RankedScore, SubmitResult, User,
} from "./types";

const TOKEN_KEY = "animeost_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // le navigateur ajoute lui-même le Content-Type multipart
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "Erreur inattendue");
  return data as T;
}

interface Credentials {
  username: string;
  password: string;
}

type NewOst = Omit<Ost, "id" | "anime_title" | "favorite" | "audio_url" | "youtube_id" | "cover_url">;

export const api = {
  register: (c: Credentials) => request<AuthResponse>("/auth/register", "POST", c),
  login: (c: Credentials) => request<AuthResponse>("/auth/login", "POST", c),
  me: () => request<User>("/auth/me"),

  animes: () => request<Anime[]>("/animes"),
  anime: (id: string) => request<AnimeDetail>(`/animes/${id}`),
  osts: (filters: OstFilters = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    return request<OstPage>(`/osts?${params}`);
  },

  createAnime: (a: Omit<Anime, "id" | "ost_count" | "image_url">) => request<Anime>("/animes", "POST", a),
  deleteAnime: (id: number) => request<void>(`/animes/${id}`, "DELETE"),
  createOst: (o: NewOst) => request<Ost>("/osts", "POST", o),
  deleteOst: (id: number) => request<void>(`/osts/${id}`, "DELETE"),
  uploadMedia: (id: number, kind: MediaKind, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Ost>(`/osts/${id}/${kind}`, "PUT", form);
  },

  history: (limit = 100, offset = 0) => request<HistoryPage>(`/history?limit=${limit}&offset=${offset}`),
  addToHistory: (ostId: number) => request<HistoryEntry>("/history", "POST", { ost_id: ostId }),
  removeFromHistory: (entryId: number) => request<void>(`/history/${entryId}`, "DELETE"),
  clearHistory: () => request<void>("/history", "DELETE"),

  playlists: () => request<PlaylistSummary[]>("/playlists"),
  playlist: (id: string | number) => request<PlaylistDetail>(`/playlists/${id}`),
  createPlaylist: (name: string, description = "") => request<PlaylistSummary>("/playlists", "POST", { name, description }),
  updatePlaylist: (id: number, patch: { name?: string; description?: string }) =>
    request<PlaylistSummary>(`/playlists/${id}`, "PATCH", patch),
  deletePlaylist: (id: number) => request<void>(`/playlists/${id}`, "DELETE"),
  addToPlaylist: (id: number, ostId: number) => request<PlaylistSummary>(`/playlists/${id}/osts/${ostId}`, "PUT"),
  removeFromPlaylist: (id: number, ostId: number) => request<PlaylistSummary>(`/playlists/${id}/osts/${ostId}`, "DELETE"),
  reorderPlaylist: (id: number, ostIds: number[]) => request<PlaylistDetail>(`/playlists/${id}/order`, "PUT", { ost_ids: ostIds }),

  submitScore: (score: {
    ost_id: number;
    difficulty: GameDifficulty;
    score: number;
    max_combo: number;
    counts: { perfect: number; great: number; good: number; miss: number };
  }) => request<SubmitResult>("/game/scores", "POST", score),
  leaderboard: (ostId: number, difficulty: GameDifficulty, limit = 10) =>
    request<RankedScore[]>(`/game/leaderboard/${ostId}?difficulty=${difficulty}&limit=${limit}`),
  players: (limit = 20) => request<PlayerRanking[]>(`/game/players?limit=${limit}`),
  myScores: () => request<MyScore[]>("/game/me/scores"),

  favorites: () => request<Ost[]>("/favorites"),
  addFavorite: (ostId: number) => request<void>(`/favorites/${ostId}`, "PUT"),
  removeFavorite: (ostId: number) => request<void>(`/favorites/${ostId}`, "DELETE"),
};
