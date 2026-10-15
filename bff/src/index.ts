import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { favoritesRouter } from "./routes/favorites.js";
import { gameRouter } from "./routes/game.js";
import { libraryRouter } from "./routes/library.js";
import { HttpError } from "./services.js";

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/favorites", favoritesRouter);
app.use("/api/game", gameRouter);
app.use("/api", libraryRouter);
app.use("/api", catalogRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Route introuvable" });
});

// Express 5 transmet automatiquement les erreurs des handlers async ici.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
  } else if (err instanceof SyntaxError) {
    res.status(400).json({ error: "JSON invalide" });
  } else {
    console.error(err);
    res.status(500).json({ error: "Erreur interne" });
  }
});

app.listen(config.port, () => {
  console.log(`BFF démarré sur http://localhost:${config.port}`);
});
