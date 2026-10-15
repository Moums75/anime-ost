import { ostService } from "./services.js";
import type { ClientOst, Ost, User } from "./types.js";

/** IDs des OST favorites de l'utilisateur (vide si anonyme). */
export async function favoriteIds(user?: User): Promise<Set<number>> {
  if (!user) return new Set();
  const favorites = await ostService<Ost[]>(`/users/${user.id}/favorites`);
  return new Set(favorites.map((o) => o.id));
}

const YOUTUBE_ID = /^[\w-]{11}$/;

/** Extrait l'ID d'une vidéo YouTube (watch?v=, youtu.be/, /embed/, /shorts/), sinon null. */
export function youtubeId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = parsed.pathname.slice(1);
  else if (host === "youtube.com") {
    id = parsed.pathname === "/watch"
      ? parsed.searchParams.get("v")
      : (parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ?? null);
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/**
 * Adapte une OST du service métier pour le front : le front n'a pas à connaître les
 * noms de fichiers internes, il reçoit directement les URLs (via le BFF), l'ID YouTube
 * et le flag favori. Le nom de fichier sert de version dans l'URL pour invalider le cache.
 * Sans pochette propre, l'OST prend celle de son anime (récupérée sur AniList).
 */
export function toClientOst(ost: Ost, favorites: Set<number>): ClientOst {
  const { audio_filename, cover_filename, anime_image_url, ...rest } = ost;
  return {
    ...rest,
    audio_url: audio_filename ? `/api/osts/${ost.id}/audio?v=${encodeURIComponent(audio_filename)}` : null,
    youtube_id: youtubeId(ost.youtube_url),
    cover_url: cover_filename
      ? `/api/osts/${ost.id}/cover?v=${encodeURIComponent(cover_filename)}`
      : anime_image_url,
    favorite: favorites.has(ost.id),
  };
}
