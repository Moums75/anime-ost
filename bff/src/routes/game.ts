import { Router } from "express";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { toClientOst } from "../ost-mapper.js";
import { ostService } from "../services.js";
import type { Ost } from "../types.js";

/** Mini-jeu OST Rush : scores et classements. */
export const gameRouter = Router();

interface Ranked {
  user_id: number;
  [key: string]: unknown;
}

const DIFFICULTIES = new Set(["easy", "normal", "hard"]);
const difficultyOf = (value: unknown) => (typeof value === "string" && DIFFICULTIES.has(value) ? value : "normal");
const limitOf = (value: unknown, fallback: number) => (typeof value === "string" && /^\d+$/.test(value) ? value : String(fallback));

// Enregistre une partie. L'identité vient du jeton vérifié, jamais du corps de la requête.
gameRouter.post("/scores", requireAuth, async (req, res) => {
  const { ost_id, difficulty, score, max_combo, counts } = req.body ?? {};
  const result = await ostService(`/users/${req.user!.id}/scores`, {
    method: "POST",
    body: { ost_id, difficulty, score, max_combo, counts, username: req.user!.username },
  });
  res.json(result);
});

// Classement d'un titre (le joueur connecté voit sa ligne mise en avant)
gameRouter.get("/leaderboard/:ostId", optionalAuth, async (req, res) => {
  const params = new URLSearchParams({ difficulty: difficultyOf(req.query.difficulty), limit: limitOf(req.query.limit, 10) });
  const rows = await ostService<Ranked[]>(`/leaderboard/osts/${encodeURIComponent(req.params.ostId as string)}?${params}`);
  res.json(rows.map((r) => ({ ...r, me: r.user_id === req.user?.id })));
});

// Classement général des joueurs
gameRouter.get("/players", optionalAuth, async (req, res) => {
  const rows = await ostService<Ranked[]>(`/leaderboard/players?limit=${limitOf(req.query.limit, 20)}`);
  res.json(rows.map((r) => ({ ...r, me: r.user_id === req.user?.id })));
});

// Tous les records du joueur connecté
gameRouter.get("/me/scores", requireAuth, async (req, res) => {
  const rows = await ostService<(Ranked & { ost: Ost })[]>(`/users/${req.user!.id}/scores`);
  res.json(rows.map((r) => ({ ...r, ost: toClientOst(r.ost, new Set()) })));
});
