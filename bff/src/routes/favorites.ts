import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { toClientOst } from "../ost-mapper.js";
import { ostService } from "../services.js";
import type { Ost } from "../types.js";

export const favoritesRouter = Router();

favoritesRouter.use(requireAuth);

favoritesRouter.get("/", async (req, res) => {
  const osts = await ostService<Ost[]>(`/users/${req.user!.id}/favorites`);
  const ids = new Set(osts.map((o) => o.id));
  res.json(osts.map((ost) => toClientOst(ost, ids)));
});

favoritesRouter.put("/:ostId", async (req, res) => {
  await ostService(`/users/${req.user!.id}/favorites/${encodeURIComponent(req.params.ostId as string)}`, {
    method: "PUT",
  });
  res.status(204).end();
});

favoritesRouter.delete("/:ostId", async (req, res) => {
  await ostService(`/users/${req.user!.id}/favorites/${encodeURIComponent(req.params.ostId as string)}`, {
    method: "DELETE",
  });
  res.status(204).end();
});
