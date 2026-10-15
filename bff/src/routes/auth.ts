import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { authService } from "../services.js";
import type { AuthResponse } from "../types.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const result = await authService<AuthResponse>("/auth/register", { method: "POST", body: req.body });
  res.status(201).json(result);
});

authRouter.post("/login", async (req, res) => {
  const result = await authService<AuthResponse>("/auth/login", { method: "POST", body: req.body });
  res.json(result);
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});
