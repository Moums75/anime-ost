import type { Request, RequestHandler } from "express";
import { authService, HttpError } from "../services.js";
import type { User } from "../types.js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Le BFF ne vérifie pas le JWT lui-même : il délègue au service d'auth.
async function resolveUser(req: Request): Promise<User | undefined> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  return authService<User>("/auth/verify", { headers: { Authorization: header } });
}

/** Renseigne req.user si un token valide est fourni, sinon continue en anonyme. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  try {
    req.user = await resolveUser(req);
  } catch (err) {
    if (!(err instanceof HttpError && err.status === 401)) throw err;
  }
  next();
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  req.user = await resolveUser(req);
  if (!req.user) throw new HttpError(401, "Authentification requise");
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== "admin") throw new HttpError(403, "Réservé aux administrateurs");
  next();
};
