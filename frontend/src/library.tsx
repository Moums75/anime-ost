import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import type { Ost, PlaylistSummary } from "./types";

/** Événement envoyé par le lecteur quand une écoute est ajoutée à l'historique */
export const HISTORY_EVENT = "animeost:history";

interface LibraryContextValue {
  playlists: PlaylistSummary[];
  /** Change à chaque modification d'une playlist : les pages ouvertes s'en servent pour se recharger */
  version: number;
  refresh: () => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<PlaylistSummary>;
  /** Ajoute l'OST à la playlist, ou l'en retire si elle y est déjà */
  togglePlaylist: (playlist: PlaylistSummary, ost: Ost) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

/** Playlists de l'utilisateur connecté, partagées entre toutes les pages et le menu « Ajouter à une playlist ». */
export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(async () => {
    setPlaylists(user ? await api.playlists() : []);
  }, [user]);

  useEffect(() => {
    refresh().catch(() => setPlaylists([]));
  }, [refresh]);

  const replace = (updated: PlaylistSummary) => {
    setPlaylists((list) => [updated, ...list.filter((p) => p.id !== updated.id)]);
    setVersion((v) => v + 1);
  };

  const value: LibraryContextValue = {
    playlists,
    version,
    refresh,
    createPlaylist: async (name, description = "") => {
      const created = await api.createPlaylist(name, description);
      replace(created);
      return created;
    },
    togglePlaylist: async (playlist, ost) => {
      const inPlaylist = playlist.ost_ids.includes(ost.id);
      replace(inPlaylist ? await api.removeFromPlaylist(playlist.id, ost.id) : await api.addToPlaylist(playlist.id, ost.id));
    },
  };

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary doit être utilisé dans <LibraryProvider>");
  return ctx;
}
