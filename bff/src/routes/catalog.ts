import { Router } from "express";
import { optionalAuth, requireAdmin, requireAuth } from "../middleware/auth.js";
import { favoriteIds, toClientOst } from "../ost-mapper.js";
import { forwardUploadToOstService, HttpError, ostService, streamFromOstService } from "../services.js";
import type { Anime, AnimeDetail, Ost, OstPage } from "../types.js";

export const catalogRouter = Router();

const MEDIA_KINDS = new Set(["audio", "cover"]);

function mediaPath(id: string, kind: string): string {
  if (!MEDIA_KINDS.has(kind)) throw new HttpError(404, "Route introuvable");
  return `/osts/${encodeURIComponent(id)}/${kind}`;
}

catalogRouter.get("/animes", async (_req, res) => {
  res.json(await ostService<Anime[]>("/animes"));
});

catalogRouter.get("/animes/:id", optionalAuth, async (req, res) => {
  const [anime, ids] = await Promise.all([
    ostService<AnimeDetail>(`/animes/${encodeURIComponent(req.params.id as string)}`),
    favoriteIds(req.user),
  ]);
  res.json({ ...anime, osts: anime.osts.map((o) => toClientOst(o, ids)) });
});

catalogRouter.get("/osts", optionalAuth, async (req, res) => {
  const params = new URLSearchParams();
  for (const key of ["q", "anime_id", "kind", "limit", "offset"]) {
    const value = req.query[key];
    if (typeof value === "string" && value) params.set(key, value);
  }
  const [page, ids] = await Promise.all([ostService<OstPage>(`/osts?${params}`), favoriteIds(req.user)]);
  res.json({ total: page.total, items: page.items.map((o) => toClientOst(o, ids)) });
});

// Public : la balise <audio>/<img> du navigateur ne peut pas envoyer de token.
catalogRouter.get("/osts/:id/:kind", async (req, res) => {
  await streamFromOstService(mediaPath(req.params.id as string, req.params.kind as string), req, res);
});

// ---------- Administration ----------

catalogRouter.post("/animes", requireAuth, requireAdmin, async (req, res) => {
  res.status(201).json(await ostService<Anime>("/animes", { method: "POST", body: req.body }));
});

catalogRouter.delete("/animes/:id", requireAuth, requireAdmin, async (req, res) => {
  await ostService(`/animes/${encodeURIComponent(req.params.id as string)}`, { method: "DELETE" });
  res.status(204).end();
});

catalogRouter.post("/osts", requireAuth, requireAdmin, async (req, res) => {
  const ost = await ostService<Ost>("/osts", { method: "POST", body: req.body });
  res.status(201).json(toClientOst(ost, new Set()));
});

catalogRouter.put("/osts/:id/:kind", requireAuth, requireAdmin, async (req, res) => {
  const path = mediaPath(req.params.id as string, req.params.kind as string);
  res.json(toClientOst(await forwardUploadToOstService<Ost>(path, req), new Set()));
});

catalogRouter.delete("/osts/:id", requireAuth, requireAdmin, async (req, res) => {
  await ostService(`/osts/${encodeURIComponent(req.params.id as string)}`, { method: "DELETE" });
  res.status(204).end();
});
