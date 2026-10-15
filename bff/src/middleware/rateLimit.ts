import type { RequestHandler } from "express";
import { HttpError } from "../services.js";

/**
 * Limite simple en mémoire : au plus `max` requêtes par adresse IP sur une fenêtre de `windowMs`.
 * Suffisant pour une instance ; avec plusieurs instances du BFF il faudrait un stockage partagé.
 */
export function rateLimit({ max, windowMs, message }: { max: number; windowMs: number; message: string }): RequestHandler {
  const hits = new Map<string, number[]>();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? "inconnu";
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      const retryAfter = Math.ceil((recent[0] + windowMs - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      throw new HttpError(429, message);
    }
    recent.push(now);
    hits.set(key, recent);
    // Ménage occasionnel pour ne pas garder les IP inactives
    if (hits.size > 10_000) for (const [ip, times] of hits) if (now - times.at(-1)! > windowMs) hits.delete(ip);
    next();
  };
}
