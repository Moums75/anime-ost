import { Router, type Request } from "express";
import { requireAuth } from "../middleware/auth.js";
import { favoriteIds, toClientOst } from "../ost-mapper.js";
import { ostService } from "../services.js";
import type { HistoryEntry, Ost, OstPage, PlaylistDetail, PlaylistSummary } from "../types.js";

/** Historique d'écoute et playlists de l'utilisateur connecté. */
export const libraryRouter = Router();

// Monté sur /api : on ne protège que ses propres préfixes, pas tout le catalogue public
libraryRouter.use(["/history", "/playlists"], requireAuth);

// L'id vient du jeton vérifié : un utilisateur ne peut toucher qu'à sa propre bibliothèque
const userPath = (req: Request, path: string) => `/users/${req.user!.id}${path}`;
const param = (req: Request, name: string) => encodeURIComponent(req.params[name] as string);

/** Adapte les OST d'une playlist (aperçu + liste complète si présente) pour le front. */
function mapPlaylist(playlist: PlaylistSummary | PlaylistDetail, favorites: Set<number>) {
  const toClient = (o: Ost) => toClientOst(o, favorites);
  return {
    ...playlist,
    preview: playlist.preview.map(toClient),
    ...("osts" in playlist && { osts: playlist.osts.map(toClient) }),
  };
}

// ---------- Historique ----------

libraryRouter.get("/history", async (req, res) => {
  const params = new URLSearchParams();
  for (const key of ["limit", "offset"]) {
    const value = req.query[key];
    if (typeof value === "string" && value) params.set(key, value);
  }
  const [page, favorites] = await Promise.all([
    ostService<OstPage<HistoryEntry>>(userPath(req, `/history?${params}`)),
    favoriteIds(req.user),
  ]);
  res.json({ total: page.total, items: page.items.map((e) => ({ ...e, ost: toClientOst(e.ost, favorites) })) });
});

libraryRouter.post("/history", async (req, res) => {
  const entry = await ostService<HistoryEntry>(userPath(req, "/history"), { method: "POST", body: req.body });
  res.status(201).json({ ...entry, ost: toClientOst(entry.ost, new Set()) });
});

libraryRouter.delete("/history", async (req, res) => {
  await ostService(userPath(req, "/history"), { method: "DELETE" });
  res.status(204).end();
});

libraryRouter.delete("/history/:entryId", async (req, res) => {
  await ostService(userPath(req, `/history/${param(req, "entryId")}`), { method: "DELETE" });
  res.status(204).end();
});

// ---------- Playlists ----------

libraryRouter.get("/playlists", async (req, res) => {
  const [playlists, favorites] = await Promise.all([
    ostService<PlaylistSummary[]>(userPath(req, "/playlists")),
    favoriteIds(req.user),
  ]);
  res.json(playlists.map((p) => mapPlaylist(p, favorites)));
});

libraryRouter.post("/playlists", async (req, res) => {
  const playlist = await ostService<PlaylistSummary>(userPath(req, "/playlists"), { method: "POST", body: req.body });
  res.status(201).json(mapPlaylist(playlist, new Set()));
});

libraryRouter.get("/playlists/:id", async (req, res) => {
  const [playlist, favorites] = await Promise.all([
    ostService<PlaylistDetail>(userPath(req, `/playlists/${param(req, "id")}`)),
    favoriteIds(req.user),
  ]);
  res.json(mapPlaylist(playlist, favorites));
});

libraryRouter.patch("/playlists/:id", async (req, res) => {
  const playlist = await ostService<PlaylistSummary>(userPath(req, `/playlists/${param(req, "id")}`), {
    method: "PATCH",
    body: req.body,
  });
  res.json(mapPlaylist(playlist, new Set()));
});

libraryRouter.delete("/playlists/:id", async (req, res) => {
  await ostService(userPath(req, `/playlists/${param(req, "id")}`), { method: "DELETE" });
  res.status(204).end();
});

libraryRouter.put("/playlists/:id/osts/:ostId", async (req, res) => {
  const path = userPath(req, `/playlists/${param(req, "id")}/osts/${param(req, "ostId")}`);
  res.json(mapPlaylist(await ostService<PlaylistSummary>(path, { method: "PUT" }), new Set()));
});

libraryRouter.delete("/playlists/:id/osts/:ostId", async (req, res) => {
  const path = userPath(req, `/playlists/${param(req, "id")}/osts/${param(req, "ostId")}`);
  res.json(mapPlaylist(await ostService<PlaylistSummary>(path, { method: "DELETE" }), new Set()));
});

libraryRouter.put("/playlists/:id/order", async (req, res) => {
  const [playlist, favorites] = await Promise.all([
    ostService<PlaylistDetail>(userPath(req, `/playlists/${param(req, "id")}/order`), { method: "PUT", body: req.body }),
    favoriteIds(req.user),
  ]);
  res.json(mapPlaylist(playlist, favorites));
});
