import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { authService, ostService } from "../services.js";
import type { AuthResponse, User } from "../types.js";

export const authRouter = Router();

// Anti force brute par adresse IP (l'API Auth bloque en plus chaque compte après 5 échecs)
const authAttempts = rateLimit({
  max: Number(process.env.AUTH_RATE_LIMIT ?? 20),
  windowMs: 15 * 60 * 1000,
  message: "Trop de tentatives depuis cette adresse : réessaie dans quelques minutes",
});

authRouter.post("/register", authAttempts, async (req, res) => {
  const result = await authService<AuthResponse>("/auth/register", { method: "POST", body: req.body });
  res.status(201).json(result);
});

authRouter.post("/login", authAttempts, async (req, res) => {
  const result = await authService<AuthResponse>("/auth/login", { method: "POST", body: req.body });
  res.json(result);
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

authRouter.put("/password", requireAuth, async (req, res) => {
  await authService("/auth/password", {
    method: "PUT",
    headers: { Authorization: req.headers.authorization! },
    body: { current_password: req.body?.current_password, new_password: req.body?.new_password },
  });
  res.status(204).end();
});

// Suppression du compte : l'API Auth vérifie le mot de passe et supprime le compte,
// puis on efface ses données (favoris, historique, playlists, scores) dans l'API Métier.
authRouter.delete("/me", requireAuth, async (req, res) => {
  const deleted = await authService<User>("/auth/me", {
    method: "DELETE",
    headers: { Authorization: req.headers.authorization! },
    body: { password: req.body?.password },
  });
  await ostService(`/users/${deleted.id}`, { method: "DELETE" });
  res.status(204).end();
});
